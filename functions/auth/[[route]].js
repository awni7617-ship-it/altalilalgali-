/* ==================================================================
   Sign in with Google and Sign in with Apple.

   The OpenID Connect authorization-code flow, using WebCrypto for
   Apple's signed client secret.
   ================================================================== */
import {
  SESSION_COOKIE, cookieHeader, redirect, clientIp, badRequest, HttpError,
} from '../lib/http.js';
import { SESSION_MS, createSession, userFromProvider } from '../lib/auth.js';

const GOOGLE = {
  authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
  token: 'https://oauth2.googleapis.com/token',
  issuers: ['https://accounts.google.com', 'accounts.google.com'],
  scope: 'openid email profile',
};
const APPLE = {
  authorize: 'https://appleid.apple.com/auth/authorize',
  token: 'https://appleid.apple.com/auth/token',
  issuers: ['https://appleid.apple.com'],
  scope: 'name email',
};

const STATE_TTL_MS = 10 * 60_000;

function providerConfig(provider, env) {
  if (provider === 'google') {
    return env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }
      : null;
  }
  if (provider === 'apple') {
    return env.APPLE_CLIENT_ID && env.APPLE_TEAM_ID && env.APPLE_KEY_ID && env.APPLE_PRIVATE_KEY
      ? { clientId: env.APPLE_CLIENT_ID }
      : null;
  }
  return null;
}

const publicUrl = (env, request) =>
  String(env.PUBLIC_URL || new URL(request.url).origin).replace(/\/+$/, '');

const redirectUri = (provider, env, request) => `${publicUrl(env, request)}/auth/${provider}/callback`;

/* ------------------------------------------------------------------ *
 * One-time state, kept in the database.
 *
 * Apple replies with a cross-site POST, and a SameSite=Lax cookie is
 * not sent on one of those — so the state cannot live in a cookie.
 * ------------------------------------------------------------------ */
async function rememberState(db, provider, next) {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const state = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const now = Date.now();
  await db.prepare('INSERT INTO oauth_states (state, provider, next_url, created_at) VALUES (?, ?, ?, ?)')
    .bind(state, provider, next || '', now).run();
  await db.prepare('DELETE FROM oauth_states WHERE created_at < ?').bind(now - STATE_TTL_MS).run();
  return state;
}

async function takeState(db, state, provider) {
  if (!state) throw badRequest('That sign-in link has expired. Please try again.', 'bad_state');
  const row = await db.prepare('SELECT * FROM oauth_states WHERE state = ?').bind(state).first();
  /* Single use, so a replayed callback cannot work. */
  await db.prepare('DELETE FROM oauth_states WHERE state = ?').bind(state).run();
  if (!row || row.provider !== provider || Date.now() - row.created_at > STATE_TTL_MS) {
    throw badRequest('That sign-in link has expired. Please try again.', 'bad_state');
  }
  return row;
}

/* ------------------------------------------------------------------ *
 * ID tokens
 *
 * The token is fetched by this server straight from the provider over
 * TLS, the case OpenID Connect allows to skip signature checking. The
 * claims themselves are still verified.
 * ------------------------------------------------------------------ */
function readIdToken(idToken, { issuers, audience }) {
  const parts = String(idToken || '').split('.');
  if (parts.length !== 3) throw badRequest('The sign-in response was not valid.', 'bad_token');

  let claims;
  try {
    const pad = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    claims = JSON.parse(atob(pad + '='.repeat((4 - (pad.length % 4)) % 4)));
  } catch {
    throw badRequest('The sign-in response could not be read.', 'bad_token');
  }

  if (!issuers.includes(claims.iss)) {
    throw badRequest('That sign-in came from an unexpected place.', 'bad_issuer');
  }
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audiences.includes(audience)) {
    throw badRequest('That sign-in was issued for a different app.', 'bad_audience');
  }
  if (typeof claims.exp === 'number' && claims.exp * 1000 < Date.now()) {
    throw badRequest('That sign-in has expired. Please try again.', 'expired');
  }
  return claims;
}

async function exchangeCode(url, params) {
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString(),
    });
  } catch {
    throw new HttpError(502, 'Could not reach the sign-in provider.', 'provider_unreachable');
  }
  const text = await response.text();
  if (!response.ok) {
    console.error('[oauth] token exchange failed', response.status, text.slice(0, 300));
    throw new HttpError(502, 'The sign-in provider refused the request.', 'provider_refused');
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(502, 'The sign-in provider sent an unreadable reply.', 'provider_bad_reply');
  }
}

/* Apple's client secret is a short-lived ES256 JWT signed with the .p8
 * key. WebCrypto's ECDSA output is already the raw r||s pair JWS wants. */
async function appleClientSecret(env) {
  const b64url = (bytes) =>
    btoa(String.fromCharCode(...new Uint8Array(bytes)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const encode = (obj) => b64url(new TextEncoder().encode(JSON.stringify(obj)));

  const pem = String(env.APPLE_PRIVATE_KEY).replace(/\\n/g, '\n');
  const body = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    'pkcs8', der.buffer, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'],
  );

  const now = Math.floor(Date.now() / 1000);
  const input = `${encode({ alg: 'ES256', kid: env.APPLE_KEY_ID, typ: 'JWT' })}.${encode({
    iss: env.APPLE_TEAM_ID, iat: now, exp: now + 300,
    aud: 'https://appleid.apple.com', sub: env.APPLE_CLIENT_ID,
  })}`;

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(input),
  );
  return `${input}.${b64url(signature)}`;
}

/* ================================================================== *
 * Routes
 * ================================================================== */
export async function onRequest({ request, env, params }) {
  const url = new URL(request.url);
  const segments = Array.isArray(params.route) ? params.route : (params.route ? [params.route] : []);
  const provider = segments[0] || '';
  const isCallback = segments[1] === 'callback';

  try {
    if (!env.DB) throw new HttpError(500, 'The database is not connected.', 'no_db');
    const config = providerConfig(provider, env);
    if (!config) return redirect('/login.html?error=provider_off');

    /* ---- send the browser off to the provider ---- */
    if (!isCallback) {
      const raw = url.searchParams.get('next') || '';
      const next = /^\/[A-Za-z0-9._~\-/]*$/.test(raw) ? raw : '';
      const state = await rememberState(env.DB, provider, next);

      const base = provider === 'google' ? GOOGLE : APPLE;
      const query = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: redirectUri(provider, env, request),
        response_type: 'code',
        scope: base.scope,
        state,
      });
      if (provider === 'google') query.set('prompt', 'select_account');
      /* Asking Apple for a scope obliges it to reply by POST. */
      else query.set('response_mode', 'form_post');

      return redirect(`${base.authorize}?${query}`);
    }

    /* ---- they came back ---- */
    let fields;
    if (request.method === 'POST') {
      fields = Object.fromEntries(await request.formData());
    } else {
      fields = Object.fromEntries(url.searchParams);
    }

    if (fields.error) return redirect('/login.html?error=cancelled');

    const entry = await takeState(env.DB, fields.state, provider);
    if (!fields.code) throw badRequest('The sign-in was cancelled.', 'no_code');

    let claims;
    let name = '';

    if (provider === 'google') {
      const tokens = await exchangeCode(GOOGLE.token, {
        code: fields.code,
        client_id: config.clientId,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri('google', env, request),
        grant_type: 'authorization_code',
      });
      claims = readIdToken(tokens.id_token, { issuers: GOOGLE.issuers, audience: config.clientId });
      if (claims.email_verified === false) {
        throw badRequest('That Google e-mail address is not verified.', 'unverified_email');
      }
      name = claims.name || claims.given_name || '';
    } else {
      const tokens = await exchangeCode(APPLE.token, {
        code: fields.code,
        client_id: config.clientId,
        client_secret: await appleClientSecret(env),
        redirect_uri: redirectUri('apple', env, request),
        grant_type: 'authorization_code',
      });
      claims = readIdToken(tokens.id_token, { issuers: APPLE.issuers, audience: config.clientId });
      /* Apple sends the name once, beside the code, never in the token. */
      if (fields.user) {
        try {
          const parsed = JSON.parse(fields.user);
          name = [parsed?.name?.firstName, parsed?.name?.lastName].filter(Boolean).join(' ');
        } catch { /* the name is optional */ }
      }
    }

    if (!claims.email) throw badRequest('That provider did not share an e-mail address.', 'no_email');

    const account = await userFromProvider(env.DB, env, {
      provider,
      providerId: claims.sub || '',
      email: String(claims.email).toLowerCase(),
      name,
    });
    const token = await createSession(env.DB, env, account.id, {
      ip: clientIp(request), userAgent: request.headers.get('User-Agent') || '',
    });

    const wantsAdmin = /^\/admin(\.html)?$/.test(entry.next_url || '');
    const destination = entry.next_url && !(wantsAdmin && account.role !== 'admin')
      ? entry.next_url
      : (account.role === 'admin' ? '/admin.html' : '/');

    return redirect(destination, cookieHeader(request, SESSION_COOKIE, token, SESSION_MS));
  } catch (err) {
    console.error('[oauth]', provider, err && err.message);
    const code = err instanceof HttpError ? err.code || 'failed' : 'failed';
    return redirect(`/login.html?error=${encodeURIComponent(code)}`);
  }
}

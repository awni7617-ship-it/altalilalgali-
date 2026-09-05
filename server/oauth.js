import { randomBytes, createSign } from 'node:crypto';
import { config } from './config.js';
import { badRequest, HttpError } from './http.js';

/* ==================================================================
 * Sign in with Google and Sign in with Apple.
 *
 * Both are the OpenID Connect authorization-code flow, written
 * against fetch and node:crypto so the shop still needs no packages.
 * ================================================================== */

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

/* ------------------------------------------------------------------ *
 * Pending sign-in attempts.
 *
 * Kept in memory rather than a cookie: Apple returns by cross-site
 * POST, and a SameSite=Lax cookie is not sent on one of those. Each
 * state is usable once, which also stops a replayed callback.
 * ------------------------------------------------------------------ */
const pending = new Map();
const STATE_TTL_MS = 10 * 60_000;

function rememberState(provider, next) {
  const state = randomBytes(24).toString('base64url');
  pending.set(state, { provider, next, at: Date.now() });
  return state;
}

function takeState(state, provider) {
  const entry = pending.get(state);
  pending.delete(state);
  if (!entry || entry.provider !== provider || Date.now() - entry.at > STATE_TTL_MS) {
    throw badRequest('That sign-in link has expired. Please try again.', 'bad_state');
  }
  return entry;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of pending) {
    if (now - entry.at > STATE_TTL_MS) pending.delete(key);
  }
}, 5 * 60_000).unref();

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */
export function redirectUri(provider) {
  return `${config.publicUrl}/auth/${provider}/callback`;
}

/**
 * Read the claims out of an ID token.
 *
 * The token is fetched by this server directly from the provider over
 * TLS, which is the case OpenID Connect explicitly allows to skip
 * signature checking (Core 3.1.3.7 §6) — nothing untrusted has touched
 * it in between. The claims themselves are still checked below.
 */
function readIdToken(idToken, { issuers, audience }) {
  const parts = String(idToken || '').split('.');
  if (parts.length !== 3) throw badRequest('The sign-in response was not valid.', 'bad_token');

  let claims;
  try {
    claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
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
  } catch (err) {
    throw new HttpError(502, 'Could not reach the sign-in provider. Please try again.', 'provider_unreachable');
  }
  const text = await response.text();
  if (!response.ok) {
    console.error('[oauth] token exchange failed:', response.status, text.slice(0, 300));
    throw new HttpError(502, 'The sign-in provider refused the request.', 'provider_refused');
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(502, 'The sign-in provider sent an unreadable reply.', 'provider_bad_reply');
  }
}

/* ------------------------------------------------------------------ *
 * Apple's client secret is a short-lived ES256 JWT that we sign with
 * the .p8 key, rather than a fixed string.
 * ------------------------------------------------------------------ */
function appleClientSecret() {
  const { clientId, teamId, keyId, privateKey } = config.oauth.apple;
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: 'ES256', kid: keyId, typ: 'JWT' };
  const payload = {
    iss: teamId,
    iat: now,
    exp: now + 300,
    aud: 'https://appleid.apple.com',
    sub: clientId,
  };
  const encode = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const signingInput = `${encode(header)}.${encode(payload)}`;

  const signer = createSign('SHA256');
  signer.update(signingInput);
  signer.end();
  /* JWS wants the raw r||s pair, not the DER wrapper OpenSSL emits. */
  const signature = signer.sign({ key: privateKey, dsaEncoding: 'ieee-p1363' });

  return `${signingInput}.${signature.toString('base64url')}`;
}

/* ------------------------------------------------------------------ *
 * Step 1 — where to send the browser
 * ------------------------------------------------------------------ */
export function authorizeUrl(provider, next = '') {
  const state = rememberState(provider, next);

  if (provider === 'google') {
    const { clientId } = config.oauth.google;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri('google'),
      response_type: 'code',
      scope: GOOGLE.scope,
      state,
      prompt: 'select_account',
    });
    return `${GOOGLE.authorize}?${params}`;
  }

  if (provider === 'apple') {
    const { clientId } = config.oauth.apple;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri('apple'),
      response_type: 'code',
      scope: APPLE.scope,
      state,
      /* Asking for a scope obliges Apple to reply by POST. */
      response_mode: 'form_post',
    });
    return `${APPLE.authorize}?${params}`;
  }

  throw badRequest('Unknown sign-in provider.', 'unknown_provider');
}

/* ------------------------------------------------------------------ *
 * Step 2 — turn the code into a person
 * ------------------------------------------------------------------ */
export async function completeSignIn(provider, { code, state, userJson }) {
  const entry = takeState(state, provider);
  if (!code) throw badRequest('The sign-in was cancelled.', 'no_code');

  if (provider === 'google') {
    const { clientId, clientSecret } = config.oauth.google;
    const tokens = await exchangeCode(GOOGLE.token, {
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri('google'),
      grant_type: 'authorization_code',
    });
    const claims = readIdToken(tokens.id_token, { issuers: GOOGLE.issuers, audience: clientId });

    if (!claims.email) throw badRequest('Google did not share an e-mail address.', 'no_email');
    if (claims.email_verified === false) {
      throw badRequest('That Google e-mail address is not verified.', 'unverified_email');
    }
    return {
      email: String(claims.email).toLowerCase(),
      name: claims.name || claims.given_name || '',
      providerId: claims.sub || '',
      next: entry.next,
    };
  }

  if (provider === 'apple') {
    const { clientId } = config.oauth.apple;
    const tokens = await exchangeCode(APPLE.token, {
      code,
      client_id: clientId,
      client_secret: appleClientSecret(),
      redirect_uri: redirectUri('apple'),
      grant_type: 'authorization_code',
    });
    const claims = readIdToken(tokens.id_token, { issuers: APPLE.issuers, audience: clientId });

    if (!claims.email) throw badRequest('Apple did not share an e-mail address.', 'no_email');

    /* Apple sends the person's name once, on the very first sign-in,
     * in a form field beside the code — never in the token. */
    let name = '';
    if (userJson) {
      try {
        const parsed = JSON.parse(userJson);
        name = [parsed?.name?.firstName, parsed?.name?.lastName].filter(Boolean).join(' ');
      } catch { /* the name is optional; carry on without it */ }
    }

    return {
      email: String(claims.email).toLowerCase(),
      name,
      providerId: claims.sub || '',
      next: entry.next,
    };
  }

  throw badRequest('Unknown sign-in provider.', 'unknown_provider');
}

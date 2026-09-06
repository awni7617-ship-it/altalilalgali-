/**
 * دار الكحل on Cloudflare.
 *
 * The Worker owns three things: the JSON API under /api, the product
 * photographs under /photo, and the fallback for anything the static asset
 * handler did not already serve. The shop front — HTML, CSS, the script —
 * never reaches this code; Cloudflare answers those from the edge.
 */
import { ROUTES, OPEN } from './api.js';
import { currentUser } from './session.js';
import { ApiError } from './lib/model.js';
import { ensureSchema, isMissingTable } from './lib/schema.js';
import { seedShop, seedOwner } from './lib/seed.js';

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
});

/**
 * A cookie rides along on same-site requests, so a form posted from another
 * site could otherwise act as the signed-in shopkeeper. SameSite=Lax already
 * blocks the common case; this closes it for anything that sends an Origin.
 */
function sameOrigin(request, url) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).host === url.host;
  } catch {
    return false;
  }
}

/**
 * A Worker can meet a database nobody has migrated — the one-click deploy
 * provisions an empty D1 and never runs wrangler's migrations. So rather than
 * check on every request, assume the tables are there and only build them when
 * something says otherwise. Costs nothing in the normal case, and turns a
 * broken first deploy into a working shop.
 *
 * Tracked against the binding rather than a plain flag, so a Worker holding
 * two databases cannot decide both are fine because one was.
 */
const healed = new WeakSet();

async function withSchema(env, work) {
  try {
    return await work();
  } catch (err) {
    if (healed.has(env.DB) || !isMissingTable(err)) throw err;
    healed.add(env.DB);
    console.log('Database has no tables yet — creating them and stocking the shop.');
    await ensureSchema(env);
    await seedShop(env);
    await seedOwner(env);
    return work();
  }
}

/**
 * The tables can exist and still be empty — a database migrated by wrangler
 * has never been seeded. Checked once per isolate, off the read path's
 * critical result, so a warm Worker never pays for it.
 */
const stocked = new WeakSet();

async function ensureStock(env) {
  if (stocked.has(env.DB)) return;
  stocked.add(env.DB);
  try {
    await seedShop(env);
    await seedOwner(env);
  } catch (err) {
    stocked.delete(env.DB);
    if (!isMissingTable(err)) console.error('Could not stock the shop', err && err.stack);
  }
}

async function handleApi(request, env, url) {
  const path = url.pathname.replace(/^\/api/, '') || '/';
  const method = request.method.toUpperCase();

  if (!['GET', 'HEAD'].includes(method) && !sameOrigin(request, url)) {
    return json({ error: 'الطلب رُفض: مصدر غير متوقّع' }, 403);
  }

  // The first query of the request, so an unmigrated database is dealt with
  // here rather than surfacing as a failed sign-in.
  const user = await withSchema(env, () => currentUser(env, request));
  await withSchema(env, () => ensureStock(env));

  if (!user && !OPEN.has(`${method} ${path}`)) {
    return json({ error: 'سجّلي الدخول للمتابعة' }, 401);
  }

  let body = {};
  if (!['GET', 'HEAD', 'DELETE'].includes(method)) {
    try {
      const text = await request.text();
      body = text ? JSON.parse(text) : {};
    } catch {
      return json({ error: 'الطلب ليس JSON صالحاً' }, 400);
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return json({ error: 'الطلب ليس JSON صالحاً' }, 400);
    }
  }

  let cookie = null;
  const context = {
    env,
    request,
    url,
    user,
    body,
    query: url.searchParams,
    setCookie: (value) => { cookie = value; },
  };

  for (const [routeMethod, pattern, handler] of ROUTES) {
    if (routeMethod !== method) continue;
    const match = path.match(pattern);
    if (!match) continue;
    try {
      const data = await withSchema(env, () => handler({ ...context, params: match.slice(1) }));
      return json(data ?? { ok: true }, 200, cookie ? { 'set-cookie': cookie } : {});
    } catch (err) {
      if (err instanceof ApiError) {
        return json({ error: err.message, ...(err.extra || {}) }, err.status);
      }
      console.error('API error', method, path, err && err.stack);
      // "Something went wrong" tells nobody anything. The shape of the failure
      // is not a secret and it is what makes it fixable, so name it — without
      // handing back a stack trace.
      const detail = String((err && err.message) || '');
      if (/exceeded|cpu|resource limits/i.test(detail)) {
        return json({
          error: 'انتهت ميزانية المعالجة لهذا الطلب. على خطة Cloudflare المجانية، خفّضي PBKDF2_ITERATIONS.',
        }, 503);
      }
      if (/no such table|not a database/i.test(detail)) {
        return json({ error: 'قاعدة البيانات لم تُجهَّز بعد. أعيدي تحميل الصفحة.' }, 503);
      }
      return json({ error: `عطل عندنا: ${detail.slice(0, 200) || 'سبب غير معروف'}` }, 500);
    }
  }

  return json({ error: `غير موجود: ${method} ${path}` }, 404);
}

/**
 * Photographs, by id. The bytes never change once written, so they are
 * immutable to the browser — which is the whole reason they are served here
 * instead of travelling inside the shop's JSON on every load.
 */
async function servePhoto(env, id) {
  const row = await env.DB.prepare('SELECT mime, data FROM photos WHERE id = ?').bind(id).first();
  if (!row) return new Response('Not found', { status: 404 });
  const binary = atob(row.data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Response(bytes, {
    headers: {
      'content-type': row.mime || 'image/jpeg',
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      if (!env.DB) return json({ error: 'لا توجد قاعدة بيانات موصولة بهذا الخادم' }, 503);
      return handleApi(request, env, url);
    }

    const photo = url.pathname.match(/^\/photo\/([A-Za-z0-9]+)$/);
    if (photo) {
      if (!env.DB) return new Response('Not found', { status: 404 });
      try {
        return await servePhoto(env, photo[1]);
      } catch {
        return new Response('Not found', { status: 404 });
      }
    }

    if (url.pathname === '/healthz') {
      return json({ ok: true, database: Boolean(env.DB), time: new Date().toISOString() });
    }

    // Anything else is a file in public/, or a link someone pasted.
    //
    // Ask for the file first and only fall back to the shell. Deployed as a
    // Worker, Cloudflare serves the static files before this code ever runs —
    // but uploaded to Pages, every request arrives here, and answering
    // /app.css with the shell would leave the shop unstyled.
    if (env.ASSETS) {
      const direct = await env.ASSETS.fetch(request);
      if (direct.status !== 404) return direct;
      const shell = await env.ASSETS.fetch(new Request(new URL('/index.html', url), request));
      return new Response(shell.body, { status: shell.status, headers: shell.headers });
    }
    return new Response('Not found', { status: 404 });
  },

  /** Housekeeping: expired sessions and spent throttle windows are not free. */
  async scheduled(event, env) {
    if (!env.DB) return;
    const now = new Date().toISOString();
    try {
      await env.DB.batch([
        env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now),
        env.DB.prepare('DELETE FROM login_attempts WHERE window_end < ?').bind(now),
      ]);
    } catch (err) {
      if (!isMissingTable(err)) throw err;
    }
  },
};

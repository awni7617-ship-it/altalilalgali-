/**
 * A client that talks to the real Worker.
 *
 * Requests go through `worker.fetch` exactly as Cloudflare would call it, so
 * the routing, the origin check, the schema self-heal and the cookie handling
 * are all under test — not stubbed around.
 */
import worker from '../../src/worker.js';
import { createTestD1 } from './d1.mjs';

const BASE = 'https://shop.test';

export function createClient({ empty = false, env = {} } = {}) {
  const DB = createTestD1({ empty });
  const bindings = {
    DB,
    // Static assets are Cloudflare's job; the tests only care about the API.
    ASSETS: { fetch: async () => new Response('<!doctype html>shell', { headers: { 'content-type': 'text/html' } }) },
    ...env,
  };
  let cookie = null;

  async function call(method, path, body) {
    const headers = { origin: BASE };
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (cookie) headers.cookie = cookie;

    const res = await worker.fetch(
      new Request(`${BASE}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
      bindings,
      {},
    );

    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      const value = setCookie.split(';')[0];
      cookie = value.endsWith('=') ? null : value;
    }

    const type = res.headers.get('content-type') || '';
    const data = type.includes('json') ? await res.json() : await res.text();
    return { status: res.status, data, headers: res.headers };
  }

  return {
    env: bindings,
    db: DB,
    get: (path) => call('GET', path),
    post: (path, body) => call('POST', path, body ?? {}),
    patch: (path, body) => call('PATCH', path, body ?? {}),
    del: (path) => call('DELETE', path),
    raw: call,
    get cookie() { return cookie; },
    set cookie(v) { cookie = v; },
    forget() { cookie = null; },
  };
}

export const OWNER = { email: 'awni7617@gmail.com', password: '123456' };

export async function signedIn(options) {
  const client = createClient(options);
  await client.get('/api/shop');           // wakes the schema and stocks the shop
  const res = await client.post('/api/session', OWNER);
  if (res.status !== 200) throw new Error(`could not sign in: ${JSON.stringify(res.data)}`);
  return client;
}

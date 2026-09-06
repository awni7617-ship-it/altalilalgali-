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

/**
 * `db` shares one database between several clients, which is how a test gets a
 * shopkeeper and a customer standing in the same shop rather than in two
 * identical empty ones.
 */
export function createClient({ empty = false, env = {}, db = null } = {}) {
  const DB = db || createTestD1({ empty });
  const bindings = {
    DB,
    // Static assets are Cloudflare's job; the tests only care about the API.
    ASSETS: {
      fetch: async () => new Response('<!doctype html>shell', { headers: { 'content-type': 'text/html' } }),
    },
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

export const SHOPPER = {
  name: 'سارة خليل',
  email: 'sara@example.com',
  password: 'lipstick-and-kohl',
  phone: '0599123456',
};

/** A client already signed in as the shopkeeper. */
export async function asOwner(options) {
  const client = createClient(options);
  await client.get('/api/shop');            // wakes the schema and stocks the sections
  const res = await client.post('/api/session', OWNER);
  if (res.status !== 200) throw new Error(`could not sign in: ${JSON.stringify(res.data)}`);
  return client;
}

/** A client signed in as a customer. Pass `{ db: owner.db }` to share a shop. */
export async function asShopper(options, who = SHOPPER) {
  const client = createClient(options);
  await client.get('/api/shop');
  const res = await client.post('/api/register', who);
  if (res.status !== 200) throw new Error(`could not register: ${JSON.stringify(res.data)}`);
  return client;
}

/** Nobody at all, looking at the same shop. */
export async function asStranger(options) {
  const client = createClient(options);
  await client.get('/api/shop');
  return client;
}

/** A product on the shelf, so a test has something to buy. */
export const LIPSTICK = {
  name: 'أحمر شفاه مطفي',
  name_en: 'Matte lipstick',
  cat: 'lips',
  house: 'Rosé Bloom',
  price: 42,
  was: 55,
  cost: 2.3,
  stock: 12,
};

export async function stock(ownerClient, extra = {}) {
  const res = await ownerClient.post('/api/products', { ...LIPSTICK, ...extra });
  if (res.status !== 200) throw new Error(`could not stock: ${JSON.stringify(res.data)}`);
  return res.data.product;
}

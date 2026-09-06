/**
 * Password hashing.
 *
 * PBKDF2-SHA256 with a per-user salt through WebCrypto — no dependencies, and
 * it runs anywhere Workers run.
 *
 * On the iteration count. A password hash is meant to be slow, and OWASP asks
 * for 600,000 rounds — but a Worker on the free plan gets 10ms of CPU for the
 * whole request, and 210,000 rounds alone costs about 30ms. Set it that high
 * and nobody can sign in at all: the request is killed before it answers.
 *
 * Measured on the slowest machine this has been built on, PBKDF2-SHA256 costs
 * about 0.46ms per thousand rounds, so 12,000 lands near 6ms and leaves the
 * database round trip and the cookie somewhere to live. tests/domain.test.js
 * holds that line.
 *
 * That is a real reduction in cost-to-crack, made deliberately, because a
 * sign-in that always fails protects nothing — and it is why sign-in is also
 * throttled per IP. Raise it with PBKDF2_ITERATIONS on a paid plan, where the
 * CPU ceiling is minutes rather than milliseconds. Existing accounts keep
 * working either way: the count is stored inside each hash and read back from
 * there when verifying.
 */

const DEFAULT_ITERATIONS = 12000;

export const bytesToHex = (bytes) => [...new Uint8Array(bytes)]
  .map((b) => b.toString(16).padStart(2, '0')).join('');

const hexToBytes = (hex) => new Uint8Array((hex.match(/.{1,2}/g) || []).map((b) => parseInt(b, 16)));

async function derive(password, salt, iterations = DEFAULT_ITERATIONS) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password, iterations = DEFAULT_ITERATIONS) {
  const rounds = Number(iterations) > 0 ? Math.floor(Number(iterations)) : DEFAULT_ITERATIONS;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, rounds);
  return `pbkdf2$${rounds}$${bytesToHex(salt)}$${bytesToHex(hash)}`;
}

/**
 * Compared byte by byte in constant time: a fast reject on the first wrong
 * character would leak the hash one character at a time.
 */
export async function verifyPassword(password, stored) {
  const [scheme, iterations, salt, hash] = String(stored || '').split('$');
  if (scheme !== 'pbkdf2' || !salt || !hash) return false;
  const candidate = await derive(String(password || ''), hexToBytes(salt), Number(iterations) || DEFAULT_ITERATIONS);
  const expected = hexToBytes(hash);
  if (candidate.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < candidate.length; i++) diff |= candidate[i] ^ expected[i];
  return diff === 0;
}

import { writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { config } from './config.js';
import { badRequest } from './http.js';

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

/* Trust the bytes, never the declared MIME type. */
const SIGNATURES = [
  { ext: '.jpg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: '.png', test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { ext: '.gif', test: (b) => b.subarray(0, 6).toString('ascii') === 'GIF89a' || b.subarray(0, 6).toString('ascii') === 'GIF87a' },
  {
    ext: '.webp',
    test: (b) => b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP',
  },
];

/**
 * Save a `data:image/...;base64,...` string as a file in public/uploads
 * and return its public URL. Identical images reuse the same file.
 */
export function saveImageDataUrl(dataUrl) {
  const value = String(dataUrl ?? '').trim();

  /* Already-hosted images (a URL the owner pasted, or one we saved
   * earlier) pass through untouched. */
  if (/^https?:\/\//i.test(value) || value.startsWith('/uploads/')) {
    if (value.length > 2000) throw badRequest('That image link is too long.');
    return value;
  }

  const match = /^data:image\/([a-z+]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(value);
  if (!match) throw badRequest('That is not a valid image.', 'bad_image');

  let bytes;
  try {
    bytes = Buffer.from(match[2].replace(/\s+/g, ''), 'base64');
  } catch {
    throw badRequest('That image could not be read.', 'bad_image');
  }
  if (bytes.length === 0) throw badRequest('That image is empty.', 'bad_image');
  if (bytes.length > MAX_IMAGE_BYTES) {
    throw badRequest('That image is larger than 4 MB. Please use a smaller photo.', 'image_too_big');
  }

  const signature = SIGNATURES.find((s) => s.test(bytes));
  if (!signature) {
    throw badRequest('Only JPG, PNG, WEBP and GIF photos are supported.', 'bad_image');
  }

  const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 32);
  const filename = `${hash}${signature.ext}`;
  const target = path.join(config.uploadDir, filename);
  if (!existsSync(target)) writeFileSync(target, bytes);
  return `/uploads/${filename}`;
}

/** Remove an uploaded file, if nothing else still points at it. */
export function deleteUpload(url, stillUsed) {
  if (!url || !url.startsWith('/uploads/') || stillUsed) return;
  const filename = path.basename(url);
  const target = path.join(config.uploadDir, filename);
  const resolved = path.resolve(target);
  if (!resolved.startsWith(config.uploadDir + path.sep)) return;
  try {
    if (existsSync(resolved)) unlinkSync(resolved);
  } catch { /* a file we cannot delete is not worth failing a request over */ }
}

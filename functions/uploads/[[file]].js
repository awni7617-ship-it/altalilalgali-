/* Serve product photos out of R2.
 * Names are content hashes, so these can be cached hard and forever. */
export async function onRequest({ params, env, request }) {
  if (!env.PHOTOS) return new Response('Photo storage is not connected.', { status: 500 });

  const name = (Array.isArray(params.file) ? params.file.join('/') : params.file) || '';
  if (!/^[0-9a-f]{32}\.(jpg|png|gif|webp)$/.test(name)) {
    return new Response('Not found', { status: 404 });
  }

  const object = await env.PHOTOS.get(name);
  if (!object) return new Response('Not found', { status: 404 });

  const etag = object.httpEtag;
  if (request.headers.get('If-None-Match') === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag } });
  }

  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
      ETag: etag,
    },
  });
}

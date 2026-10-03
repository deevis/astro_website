// Gzip is an asset format here, so the site needs no special server headers.
export async function snapshotFetch(url, options) {
  const compressed = typeof url === 'string' && url.startsWith('data/') && url.endsWith('.json') && url !== 'data/catalog.json';
  const response = await globalThis.fetch(compressed ? url + '.gz' : url, options);
  if (!compressed || !response.ok) return response;
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) {
    // Some hosts transparently decode .gz assets.
    return new Response(buffer, { headers: { 'content-type': 'application/json' } });
  }
  if (typeof DecompressionStream === 'undefined') throw new Error('This interactive snapshot needs a current browser with gzip decompression support.');
  return new Response(new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip')), {
    headers: { 'content-type': 'application/json' }
  });
}

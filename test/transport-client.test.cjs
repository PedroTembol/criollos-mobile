const { test } = require('node:test');
const assert = require('node:assert/strict');
require('./content-test-loader.cjs');
const { createTransportClient } = require('../components/transportClient.ts');
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
function setup(fetch) {
  const cache = new Map(); let now = Date.parse('2026-10-03T12:00:00Z');
  const storage = { getItem: async key => cache.get(key) ?? null, setItem: async (key, value) => cache.set(key, value) };
  return { cache, storage, advance: ms => { now += ms; }, client: createTransportClient({ baseUrl: 'https://criollos.app/api/v1', storage, fetch, now: () => now, timeoutMs: 100 }) };
}
test('API rejects HTML, upstream failures and malformed schema instead of storing successful emptiness', async () => {
  for (const response of [new Response('<html>page</html>', { headers: { 'Content-Type': 'text/html' } }), json({ status: 'error', data: [] }), json({ status: 'success', data: {} })]) {
    const { client, cache } = setup(async () => response);
    await assert.rejects(client.persistentRequest('/eventos')); assert.equal(cache.size, 0);
  }
  const { client } = setup(async () => json({ total_seconds: -1, error: 'Unavailable' }));
  await assert.rejects(client.request('/eta'));
});
test('network and fallback normalize stops, preserve original timestamps and label cache age', async () => {
  let offline = false;
  const { client, advance } = setup(async () => { if (offline) throw new Error('offline'); return json({ stops: [{ id: 1, lat: 18_000_000, lng: -66_000_000 }], fetchedAt: '2026-10-03T11:55:00Z', stale: true }); });
  const fresh = await client.persistentRequest('/stops');
  assert.equal(fresh.stops[0].lat, 18); assert.equal(fresh.clientCache.source, 'network');
  offline = true; advance(60_000);
  const cached = await client.persistentRequest('/stops');
  assert.equal(cached.clientCache.source, 'local-cache'); assert.equal(cached.clientCache.ageMs, 60_000);
  assert.equal(cached.clientCache.cachedAt, fresh.clientCache.cachedAt);
  assert.equal(cached.fetchedAt, fresh.fetchedAt); assert.equal(cached.stale, true); assert.equal(cached.stops[0].lat, 18);
});
test('server, limit and date filters never reuse a different cache response', async () => {
  let offline = false; const { client } = setup(async () => { if (offline) throw new Error('offline'); return json({ data: [{ id: 'one' }] }); });
  await client.persistentRequest('/discovery', { query: { limit: 3, from: '2026-10-03' } }); offline = true;
  for (const options of [{ query: { limit: 9, from: '2026-10-03' } }, { query: { limit: 3, from: '2026-10-04' } }, { baseUrl: 'http://localhost:3000/api/v1', query: { limit: 3, from: '2026-10-03' } }]) await assert.rejects(client.persistentRequest('/discovery', options));
});
test('authorization errors do not fall back to privileged cache and omit raw server text', async () => {
  let denied = false; const { client } = setup(async () => denied ? json({ message: 'sensitive upstream text' }, 401) : json({ routes: [] }));
  await client.persistentRequest('/routes'); denied = true;
  await assert.rejects(client.persistentRequest('/routes'), error => error.status === 401 && !error.message.includes('sensitive'));
});
test('expired and corrupted caches fail honestly; feed cache expires after a day', async () => {
  let offline = false; const { client, cache, advance } = setup(async () => { if (offline) throw new Error('offline'); return json({ data: [] }); });
  await client.persistentRequest('/eventos'); offline = true; advance(86_400_001);
  await assert.rejects(client.persistentRequest('/eventos'));
  for (const key of cache.keys()) cache.set(key, '{broken');
  await assert.rejects(client.persistentRequest('/eventos'));
});
test('request timeout aborts a stalled request and restores a usable retry', async () => {
  let stalled = true;
  const { client } = setup(async (url, options) => {
    if (!stalled) return json({ positions: [] });
    return new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
  });
  await assert.rejects(client.request('/vehicles/positions'), /tardó demasiado/);
  stalled = false; assert.deepEqual(await client.request('/vehicles/positions'), { positions: [] });
});

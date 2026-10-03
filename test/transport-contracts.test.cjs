const { test } = require('node:test');
const assert = require('node:assert/strict');
require('./content-test-loader.cjs');
const { buildApiUrl, normalizeApiBaseUrl, apiCacheKey, normalizeRoutePoints, resolveStop, resolveRouteId, etaCoordinates, validEtaCoordinates, positionFreshness } = require('../components/transportContracts.ts');
const { planRoute } = require('../components/transportPlanner.ts');
const { haversineMeters } = require('../components/transportGeo.ts');
const { createFavoritesStore, parseFavorites } = require('../components/transportFavoritesStore.ts');
const { contentActionTarget } = require('../components/contentActions.ts');

test('legacy map actions and modern transport URLs preserve all transport selections', () => {
  for (const [key, id] of [['stopId', '123'], ['routeId', '4'], ['assetId', '5'], ['routePointId', '901']]) {
    for (const value of [`/#map?${key}=${id}`, `/transporte?${key}=${id}`, `https://criollos.app/#map?${key}=${id}`]) {
      assert.deepEqual(contentActionTarget(value), { pathname: '/', params: { [key]: id } });
    }
  }
  assert.deepEqual(contentActionTarget('/transporte?routeId=4&stopId=123&assetId=5'), { pathname: '/', params: { routeId: '4', stopId: '123', assetId: '5' } });
  assert.deepEqual(contentActionTarget('/?routeId=2#map?routeId=4&stopId=123&q=Plaza%20Centro'), { pathname: '/', params: { routeId: '2', stopId: '123', q: 'Plaza Centro' } });
  assert.deepEqual(contentActionTarget('/#other?stopId=123'), { pathname: '/', params: {} });
  assert.equal(contentActionTarget('https://external.example/#map?assetId=5'), null);
  assert.equal(contentActionTarget('https://user:secret@criollos.app/transporte?assetId=5'), null);
});

test('every endpoint preserves the version prefix with either slash style and base trailing slash', () => {
  for (const base of ['https://criollos.app/api/v1', 'https://criollos.app/api/v1/']) {
    for (const path of ['/bootstrap', '/eventos', '/gastronomia', '/discovery', '/vehicles/positions', 'routes']) {
      assert.equal(new URL(buildApiUrl(path, base)).pathname, `/api/v1/${path.replace(/^\//, '')}`);
    }
  }
  assert.equal(buildApiUrl('/stops', 'http://10.0.2.2:3000/api/v1'), 'http://10.0.2.2:3000/api/v1/stops');
});
test('API URLs reject invalid overrides and cache identities include base and every filter', () => {
  for (const value of ['javascript:alert(1)', 'https://user:password@example.com', 'https://example.com/api?q=1', 'https://example.com/#map']) assert.throws(() => normalizeApiBaseUrl(value));
  const a = apiCacheKey(buildApiUrl('/discovery', 'https://criollos.app/api/v1', { limit: 3, from: '2026-10-03', type: 'evento' }));
  assert.equal(a, apiCacheKey(buildApiUrl('/discovery', 'https://criollos.app/api/v1/', { type: 'evento', from: '2026-10-03', limit: 3 })));
  assert.notEqual(a, apiCacheKey(buildApiUrl('/discovery', 'https://criollos.app/api/v1', { limit: 9, from: '2026-10-03', type: 'evento' })));
  assert.notEqual(a, apiCacheKey(buildApiUrl('/discovery', 'http://localhost:3000/api/v1', { limit: 3, from: '2026-10-03', type: 'evento' })));
});
test('microdegree stops normalize once; degrees stay unchanged and invalid points are omitted', () => {
  const points = normalizeRoutePoints([{ id: 1, lat: 18_234_100, lng: -66_048_500 }, { id: 2, lat: 18.235, lng: -66.049 }, { id: 3, lat: Infinity, lng: 0 }]);
  assert.deepEqual(points.map(p => [p.lat, p.lng]), [[18.2341, -66.0485], [18.235, -66.049]]);
  assert.deepEqual(normalizeRoutePoints(points), points);
  assert.ok(haversineMeters(points[0], points[1]) < 150);
});
test('prefixed stop IDs resolve marker metadata while explicit routePointId takes precedence', () => {
  const stops = [{ id: 123, markerId: 50 }, { id: 901, markerId: 123 }, { id: 902, markerId: 123 }];
  for (const result of [{ id: 'stop-123' }, { id: 's-nearby-123' }, { id: 'arbitrary', metadata: { stopId: 123 } }]) assert.equal(resolveStop(result, stops)?.id, 901);
  assert.equal(resolveStop({ id: 'stop-123', metadata: { routePointId: 902 } }, stops)?.id, 902);
  assert.equal(resolveStop({ id: '123' }, stops)?.id, 123);
  assert.equal(resolveStop({ id: 'stop-nope' }, stops), null);
  assert.equal(resolveRouteId({ id: 'route-4' }), 4);
  assert.equal(resolveRouteId({ id: 'wrong', metadata: { routeId: 8 } }), 8);
});
test('ETA requires a vehicle and stop pair in degrees; single pairs never qualify', () => {
  const value = etaCoordinates({ lat: 18.23, lng: -66.05 }, { id: 1, lat: 18.2341, lng: -66.0485 });
  assert.equal(value, '18.23,-66.05|18.2341,-66.0485');
  assert.equal(validEtaCoordinates(value), true);
  for (const bad of ['18,-66', '18000000,-66000000|18,-66', '18,-66|,', '18,-66|19,-65|20,-64', 'NaN,-66|19,-65']) assert.equal(validEtaCoordinates(bad), false);
  assert.equal(etaCoordinates(null, { id: 1, lat: 18, lng: -66 }), undefined);
});
test('vehicle freshness is based on actual telemetry, including invalid and future timestamps', () => {
  const now = Date.parse('2026-10-03T12:00:00Z');
  assert.equal(positionFreshness({ when: '2026-10-03T11:59:00Z' }, now), 'live');
  assert.equal(positionFreshness({ when: '2026-10-03T11:55:00Z' }, now), 'stale');
  assert.equal(positionFreshness({ when: '2026-10-03T12:05:00Z' }, now), 'unknown');
  assert.equal(positionFreshness({}, now), 'unknown');
});
test('planner boards at designated stops, follows ordered route and permits short direct walking', () => {
  const points = normalizeRoutePoints([
    { id: 1, routeId: 1, direction: 0, order: 1, markerId: 10, lat: 18_000_000, lng: -66_000_000 },
    { id: 2, routeId: 1, direction: 0, order: 2, markerId: null, lat: 18_000_000, lng: -65_999_000, seconds: 10 },
    { id: 3, routeId: 1, direction: 0, order: 3, markerId: 11, lat: 18_000_000, lng: -65_990_000, seconds: 30 },
  ]);
  const result = planRoute(points[0], points[2], points, { maxWalkMeters: 20 });
  assert.ok(result.steps.some(step => step.mode === 'trolley'));
  assert.equal(result.totalDurationSec, 42);
  assert.equal(planRoute(points[1], points[2], points, { maxWalkMeters: 20 }), null);
  assert.equal(planRoute(points[0], { lat: 18, lng: -65.9999 }, [], { maxWalkMeters: 20 }).steps[0].mode, 'walk');
  assert.equal(planRoute({ lat: NaN, lng: 0 }, points[2], points), null);
});
test('favorite store handles double taps, syncs subscribers and serializes final persisted state', async () => {
  const writes = []; const store = createFavoritesStore({ getItem: async () => null, setItem: async (key, value) => { writes.push(JSON.parse(value)); } }, 'favorites');
  let notifications = 0; store.subscribe(() => notifications++);
  store.toggleStop(1); assert.deepEqual(store.getSnapshot().favorites.stopIds, []);
  await store.load(); store.toggleStop(1); store.toggleStop(1); store.toggleStop(2); await store.flush();
  assert.deepEqual(store.getSnapshot().favorites.stopIds, [2]);
  assert.deepEqual(writes.at(-1).stopIds, [2]); assert.equal(notifications, 4);
  store.toggleStop(NaN); assert.deepEqual(store.getSnapshot().favorites.stopIds, [2]);
});
test('corrupt favorites recover and storage failures remain visible', async () => {
  assert.deepEqual(parseFavorites('{invalid'), { stopIds: [], places: [] });
  assert.deepEqual(parseFavorites(JSON.stringify({ stopIds: [1, 1, -1, '2'], places: [{ id: 'x', label: 'X', lat: 999, lng: 0 }] })), { stopIds: [1], places: [] });
  const store = createFavoritesStore({ getItem: async () => null, setItem: async () => { throw new Error('disk full'); } }, 'favorites');
  await store.load(); store.toggleStop(1); await store.flush(); assert.equal(store.getSnapshot().storageError, true);
});

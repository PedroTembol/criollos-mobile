const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const React = require('react');
const { create, act } = require('react-test-renderer');
require('./content-test-loader.cjs');
const { TransportApiError, retryTransportQuery } = require('../components/transportClient.ts');
global.IS_REACT_ACT_ENVIRONMENT = true;
let ready = true, focused = true, callback, captured, apiBaseUrl = 'https://criollos.app/api/v1';
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === '@tanstack/react-query') return { useQuery: options => { captured = options; return {}; } };
  if (request === 'react-native') return { AppState: { currentState: 'active', addEventListener: (event, cb) => { callback = cb; return { remove() {} }; } } };
  if (request === '@react-navigation/native') return { useIsFocused: () => focused };
  if (request === './transportSettings') return { useTransportSettings: () => ({ ready, apiBaseUrl, positionRefreshMs: 8000 }) };
  if (request === './transportApi') return new Proxy({}, { get: () => () => { throw new Error('Tests must not contact production'); } });
  return originalLoad.call(this, request, parent, isMain);
};
const { usePositionsQuery, useEtaQuery, useBootstrapQuery, useEventosQuery } = require('../components/transportQueries.ts');
let tree;
afterEach(async () => { if (tree) await act(async () => tree.unmount()); tree = null; ready = true; focused = true; });
async function render(hook) { const Screen = () => { hook(); return null; }; await act(async () => { tree = create(React.createElement(Screen)); }); return Screen; }
test('live polling waits for settings, pauses on background and tab changes, and stops on auth errors', async () => {
  ready = false; const Screen = await render(usePositionsQuery); assert.equal(captured.enabled, false);
  ready = true; await act(async () => tree.update(React.createElement(Screen))); assert.equal(captured.enabled, true);
  assert.equal(captured.refetchInterval({ state: { error: null } }), 8000);
  assert.equal(captured.refetchInterval({ state: { error: new TransportApiError('Denied', 401) } }), false);
  await act(async () => callback('background')); assert.equal(captured.enabled, false); assert.equal(captured.refetchInterval({ state: { error: null } }), false);
  await act(async () => callback('active')); assert.equal(captured.enabled, true);
  focused = false; await act(async () => tree.update(React.createElement(Screen))); assert.equal(captured.enabled, false);
});
test('ETA hook never enables single-coordinate request and bootstrap honors configured server hydration', async () => {
  await render(() => useEtaQuery({ latlngs: '18,-66' })); assert.equal(captured.enabled, false);
  await act(async () => tree.unmount()); tree = null;
  await render(() => useEtaQuery({ latlngs: '18,-66|18.1,-66.1' })); assert.equal(captured.enabled, true);
  await act(async () => tree.unmount()); tree = null;
  ready = false; await render(useBootstrapQuery); assert.equal(captured.enabled, false); assert.deepEqual(captured.queryKey, ['bootstrap', apiBaseUrl]);
});
test('authorization errors have no automatic retry; other network errors get one bounded retry', () => {
  assert.equal(retryTransportQuery(0, new TransportApiError('Denied', 403)), false);
  assert.equal(retryTransportQuery(0, new Error('offline')), true);
  assert.equal(retryTransportQuery(1, new Error('offline')), false);
});
test('event query does not fetch when a caller rejects invalid date filters', async () => {
  await render(() => useEventosQuery({ from: 'invalid' }, false));
  assert.equal(captured.enabled, false);
  assert.deepEqual(captured.queryKey, ['eventos', apiBaseUrl, { from: 'invalid' }]);
});

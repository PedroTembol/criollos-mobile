const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const React = require('react');
const { create, act } = require('react-test-renderer');
require('./content-test-loader.cjs');
global.IS_REACT_ACT_ENVIRONMENT = true;
const load = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === 'react-native') return { View: 'View', Text: 'Text', ScrollView: 'ScrollView', Pressable: 'Pressable', StyleSheet: { create: value => value } };
  return load.call(this, request, parent, isMain);
};
const { TrackingDashboard } = require('../components/TrackingDashboard.tsx');
let tree;
afterEach(async () => { if (tree) await act(async () => tree.unmount()); tree = null; });
async function render(summary) { await act(async () => { tree = create(React.createElement(TrackingDashboard, { snapshot: { vehicles: [], summary }, onRoutePress: () => {} })); }); return JSON.stringify(tree.toJSON()); }
const summary = (overrides = {}) => ({ totalVehicles: 0, liveVehicles: 0, movingVehicles: 0, routes: [], serviceHealth: { status: 'offline', liveCoveragePercent: 0 }, ...overrides });
test('zero telemetry expresses missing signals without claiming system outage or service interruption', async () => {
  const content = await render(summary());
  assert.match(content, /Sin señales recientes/);
  assert.match(content, /no confirma si el servicio está operando/);
  assert.doesNotMatch(content, /Fuera de Línea|Sin servicio|Servicio Degradado/);
});
test('old route telemetry does not present its old next stop as a current arrival', async () => {
  const content = await render(summary({ totalVehicles: 1, routes: [{ routeId: 1, routeName: 'Ruta Plaza', routeColor: null, healthLabel: 'offline', liveVehicles: 0, movingVehicles: 0, nextStops: ['Parada Antigua'] }] }));
  assert.match(content, /Sin señal reciente/);
  assert.doesNotMatch(content, /Próxima|Parada Antigua|Sin servicio/);
});
test('recent telemetry retains route actions and the currently reported next stop', async () => {
  let selected;
  const live = summary({ totalVehicles: 1, liveVehicles: 1, movingVehicles: 1, serviceHealth: { status: 'healthy', liveCoveragePercent: 100 }, routes: [{ routeId: 1, routeName: 'Ruta Plaza', routeColor: null, healthLabel: 'operational', liveVehicles: 1, movingVehicles: 1, nextStops: ['Parada Plaza'] }] });
  await act(async () => { tree = create(React.createElement(TrackingDashboard, { snapshot: { vehicles: [], summary: live }, onRoutePress: id => { selected = id; } })); });
  const content = JSON.stringify(tree.toJSON());
  assert.match(content, /Señales recientes/); assert.match(content, /Parada Plaza/);
  await act(async () => tree.root.findByType('Pressable').props.onPress()); assert.equal(selected, 1);
});

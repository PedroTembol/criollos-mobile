const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const React = require('react');
const { create, act } = require('react-test-renderer');
require('./content-test-loader.cjs');
global.IS_REACT_ACT_ENVIRONMENT = true;

let params, query, etaOptions, etaEnabled, refreshCalls, mapMoves, back, locationCalls, permission, settings, savedUrl, feedbackCalls, alerts, favorites;
const baseQuery = data => ({ data, isLoading: false, isFetching: false, isError: false, error: null, refetch: async () => { refreshCalls++; } });
const stop = { id: 901, markerId: 123, routeId: 1, direction: 0, order: 1, lat: 18.23, lng: -66.05 };
const route = { id: 1, description: 'Ruta Plaza', directionStartName: 'Terminal', directionEndName: 'Plaza' };
function reset() {
  params = {}; etaOptions = null; etaEnabled = false; refreshCalls = 0; mapMoves = []; back = null; locationCalls = 0; savedUrl = null; feedbackCalls = 0; alerts = [];
  permission = async () => ({ status: 'granted' });
  native.Platform.OS = 'web';
  settings = { ready: true, lowDataMode: false, apiBaseUrl: null, positionRefreshMs: 8000, setLowDataMode() {}, setApiBaseUrl(value) {
    if (value && !/^https?:\/\//.test(value)) throw new Error('URL inválida'); savedUrl = value;
  } };
  favorites = { loaded: true, storageError: false, favorites: { stopIds: [], places: [] }, isStopFavorite: () => false, toggleStopFavorite() {}, removePlace() {} };
  query = {
    bootstrap: baseQuery({ stops: [stop], routePoints: [stop], routes: [route], markers: [{ id: 123, description: 'Parada Plaza', lat: 18.23, lng: -66.05 }], positions: [], fetchedAt: '2026-10-03T08:00:00Z' }),
    stops: baseQuery(undefined), routes: baseQuery(undefined), positions: baseQuery({ positions: [], fetchedAt: '2026-10-03T08:00:00Z' }),
    tracking: baseQuery(undefined), nearby: baseQuery(undefined), discovery: baseQuery({ data: [] }), eta: baseQuery({ total_seconds: 90 }),
  };
}
const queries = {
  useBootstrapQuery: () => query.bootstrap, useStopsQuery: () => query.stops, useRoutesQuery: () => query.routes,
  usePositionsQuery: () => query.positions, useTrackingQuery: () => query.tracking, useNearbyStopsQuery: () => query.nearby,
  useDiscoveryQuery: () => query.discovery, useEtaQuery: (options, enabled) => { etaOptions = options; etaEnabled = enabled; return query.eta; },
};
const native = {
  View: 'View', Text: 'Text', Pressable: 'Pressable', TextInput: 'TextInput', ScrollView: 'ScrollView', ActivityIndicator: 'ActivityIndicator', Switch: 'Switch',
  Modal: props => props.visible ? React.createElement('Modal', props, props.children) : null,
  StyleSheet: { create: value => value }, Platform: { OS: 'web' },
  BackHandler: { addEventListener: (event, callback) => { back = callback; return { remove: () => { back = null; } }; } },
  Alert: { alert: (...args) => alerts.push(args) },
};
const FakeMap = React.forwardRef((props, ref) => {
  React.useImperativeHandle(ref, () => ({ animateToRegion: region => mapMoves.push(region) }));
  return React.createElement('MapView', props, props.children);
});
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === 'react-native') return native;
  if (request === 'react-native-maps') return { __esModule: true, default: FakeMap, Marker: 'Marker', Polyline: 'Polyline' };
  if (request === '@expo/vector-icons/FontAwesome') return 'Icon';
  if (request === 'expo-location') return { requestForegroundPermissionsAsync: async () => { locationCalls++; return permission(); }, getCurrentPositionAsync: async () => ({ coords: { latitude: 18.23, longitude: -66.05 } }) };
  if (request === 'expo-router') return { useRouter: () => ({ push() {} }), useLocalSearchParams: () => params };
  if (request.endsWith('/transportQueries')) return queries;
  if (request.endsWith('/transportFavorites')) return { useFavorites: () => favorites };
  if (request.endsWith('/transportSettings')) return { useTransportSettings: () => settings };
  if (request.endsWith('/SearchOverlay')) return { SearchOverlay: props => React.createElement('SearchOverlay', props) };
  if (request.endsWith('/NearbyStopsPanel')) return { NearbyStopsPanel: props => React.createElement('NearbyStopsPanel', props) };
  if (request.endsWith('/TrackingDashboard')) return { TrackingDashboard: props => React.createElement('TrackingDashboard', props) };
  if (request.endsWith('/transportApi')) return { getApiBaseUrl: () => 'https://criollos.app/api/v1', sendFeedback: async () => { feedbackCalls++; return { ok: true }; } };
  if (request === '@tanstack/react-query') return { useMutation: configuration => ({ isPending: false, mutate() {
    return configuration.mutationFn().then(configuration.onSuccess, configuration.onError).finally(configuration.onSettled);
  } }) };
  if (request.startsWith('@/')) return originalLoad.call(this, path.join(__dirname, '..', request.slice(2)), parent, isMain);
  return originalLoad.call(this, request, parent, isMain);
};
// Use map-capable rendering, but prevent auto location prompts with the screen's isWeb snapshot.
const { default: TransportScreen } = require('../app/(tabs)/index.tsx');
const { default: SettingsScreen } = require('../app/(tabs)/two.tsx');
let trees = [];
afterEach(async () => { await act(async () => trees.forEach(tree => tree.unmount())); trees = []; });
async function render(component = React.createElement(TransportScreen)) { let tree; await act(async () => { tree = create(component); }); trees.push(tree); return tree; }
const text = tree => JSON.stringify(tree.toJSON());
const button = (tree, label) => tree.root.findAllByType('Pressable').find(node => node.props.accessibilityLabel === label);

test('catalogue loading, auth failure, stale copy and telemetry age stay visible without fabricated live counts', async () => {
  reset(); query.bootstrap = { ...query.bootstrap, isLoading: true, isFetching: true, data: undefined };
  const tree = await render(); assert.match(text(tree), /Cargando catálogo/);
  query.bootstrap = baseQuery({ stops: [stop], routes: [route], routePoints: [stop], markers: [], positions: [], clientCache: { source: 'local-cache', cachedAt: '2026-10-01T08:00:00Z', ageMs: 1000 } });
  query.positions = { ...baseQuery({ positions: [{ assetId: 5, routeId: 1, lat: 18.23, lng: -66.05, when: '2026-10-01T08:00:00Z' }], fetchedAt: '2026-10-01T08:00:00Z' }), isError: true, error: new Error('Este servicio requiere acceso autorizado.') };
  await act(async () => tree.update(React.createElement(TransportScreen)));
  assert.match(text(tree), /Copia guardada/); assert.match(text(tree), /acceso autorizado/); assert.match(text(tree), /Última posición/); assert.doesNotMatch(text(tree), /Estado en vivo/);
  assert.equal(button(tree, 'Actualizar datos de transporte').props.disabled, false);
});
test('prefixed search selects the correct stop, resets ETA and closes with Android back', async () => {
  reset(); const tree = await render();
  await act(async () => button(tree, 'Buscar en Criollos').props.onPress());
  await act(async () => assert.equal(back(), true));
  await act(async () => button(tree, 'Buscar en Criollos').props.onPress());
  await act(async () => tree.root.findByType('SearchOverlay').props.onResultPress({ id: 'stop-123', type: 'stop', title: 'Plaza', metadata: { stopId: 123 } }));
  assert.match(text(tree), /Parada Plaza/); assert.equal(tree.root.findAllByType('Modal').length, 1); assert.equal(etaEnabled, false);
  await act(async () => tree.root.findByType('Modal').props.onRequestClose());
  assert.equal(tree.root.findAllByType('Modal').length, 0);
});
test('route search opens useful route detail and route map action closes it', async () => {
  reset(); const tree = await render();
  await act(async () => button(tree, 'Buscar en Criollos').props.onPress());
  await act(async () => tree.root.findByType('SearchOverlay').props.onResultPress({ id: 'route-1', type: 'route', title: 'Ruta Plaza', metadata: { routeId: 1 } }));
  assert.match(text(tree), /Terminal/); assert.match(text(tree), /Abrir Parada Plaza/);
  await act(async () => button(tree, 'Ver trazado de ruta en mapa').props.onPress());
  assert.equal(tree.root.findAllByType('Modal').length, 0);
});
test('deep-linked stop metadata waits for catalogue then resolves once; new links update search input', async () => {
  reset(); params = { stopId: '123' }; query.bootstrap = baseQuery(undefined);
  const tree = await render(); assert.equal(tree.root.findAllByType('Modal').length, 0);
  query.bootstrap = baseQuery({ stops: [stop], markers: [{ id: 123, description: 'Plaza' }], routes: [route], routePoints: [stop], positions: [] });
  await act(async () => tree.update(React.createElement(TransportScreen)));
  assert.equal(tree.root.findAllByType('Modal').length, 1);
  await act(async () => button(tree, 'Cerrar detalle').props.onPress());
  await act(async () => tree.update(React.createElement(TransportScreen)));
  assert.equal(tree.root.findAllByType('Modal').length, 0);
  params = { q: 'Teatro' }; await act(async () => tree.update(React.createElement(TransportScreen)));
  assert.equal(tree.root.findByType('SearchOverlay').props.initialQuery, 'Teatro');
});
test('ETA uses live vehicle-stop coordinates and avoids unreliable stale positions', async () => {
  reset(); query.positions.data.positions = [{ assetId: 5, routeId: 1, lat: 18.24, lng: -66.06, when: new Date().toISOString() }];
  const tree = await render(); await act(async () => button(tree, 'Buscar en Criollos').props.onPress());
  await act(async () => tree.root.findByType('SearchOverlay').props.onResultPress({ id: 'stop-123', type: 'stop', title: 'Plaza' }));
  assert.equal(etaOptions.latlngs, '18.24,-66.06|18.23,-66.05');
  await act(async () => tree.root.findAllByType('Pressable').find(node => node.props.accessibilityHint?.includes('tiempos estimados')).props.onPress());
  assert.equal(etaEnabled, true); assert.match(text(tree), /2 min/);
  query.positions = baseQuery({ positions: [{ assetId: 5, routeId: 1, lat: 18.24, lng: -66.06, when: '2020-01-01T00:00:00Z' }] });
  await act(async () => tree.update(React.createElement(TransportScreen)));
  assert.equal(etaOptions.latlngs, undefined); assert.equal(etaOptions.assetId, undefined); assert.match(text(tree), /No hay un trolley con señal reciente/);
});
test('refresh double taps share one fetch group and recover after completion', async () => {
  reset(); let resolve; const waiting = new Promise(r => { resolve = r; });
  for (const name of ['bootstrap', 'stops', 'routes', 'positions', 'tracking']) query[name].refetch = () => { refreshCalls++; return waiting; };
  const tree = await render(); let first;
  await act(async () => { first = button(tree, 'Actualizar datos de transporte').props.onPress(); button(tree, 'Actualizar datos de transporte').props.onPress(); });
  assert.equal(refreshCalls, 5); resolve(); await act(async () => first);
  await act(async () => button(tree, 'Actualizar datos de transporte').props.onPress()); assert.equal(refreshCalls, 10);
});
test('location double taps share one prompt and denied permissions can be retried', async () => {
  reset(); let resolve; permission = () => new Promise(r => { resolve = r; });
  const tree = await render(); await act(async () => button(tree, 'Ver lista de trolleys y paradas').props.onPress()); let first;
  await act(async () => { first = button(tree, 'Actualizar ubicación actual').props.onPress(); button(tree, 'Actualizar ubicación actual').props.onPress(); });
  assert.equal(locationCalls, 1); assert.equal(button(tree, 'Actualizar ubicación actual').props.disabled, true);
  resolve({ status: 'denied' }); await act(async () => first); assert.match(text(tree), /permiso de ubicación/);
  permission = async () => ({ status: 'granted' }); await act(async () => button(tree, 'Actualizar ubicación actual').props.onPress());
  assert.equal(locationCalls, 2); assert.match(text(tree), /0 m/);
});
test('settings only save a valid committed API URL and feedback double taps send once', async () => {
  reset(); const tree = await render(React.createElement(SettingsScreen));
  const input = tree.root.findAllByType('TextInput')[0];
  await act(async () => input.props.onChangeText('bad')); assert.equal(savedUrl, null);
  await act(async () => button(tree, 'Guardar URL de API').props.onPress()); assert.equal(savedUrl, null); assert.match(text(tree), /URL inválida/);
  await act(async () => input.props.onChangeText('https://example.com/api/v1'));
  await act(async () => button(tree, 'Guardar URL de API').props.onPress()); assert.equal(savedUrl, 'https://example.com/api/v1');
  await act(async () => tree.root.findAllByType('TextInput')[1].props.onChangeText('Servicio excelente'));
  await act(async () => { button(tree, 'Enviar feedback').props.onPress(); button(tree, 'Enviar feedback').props.onPress(); });
  assert.equal(feedbackCalls, 1); assert.equal(alerts.length, 1); assert.equal(alerts[0][0], 'Gracias');
});
test('map coordinate links center the map and route selection displays the ordered shape', async () => {
  reset(); native.Platform.OS = 'ios'; params = { lat: '18.25', lng: '-66.04' };
  delete require.cache[require.resolve('../app/(tabs)/index.tsx')];
  const NativeTransportScreen = require('../app/(tabs)/index.tsx').default;
  query.bootstrap.data.routePoints = [stop, { ...stop, id: 902, order: 2, lat: 18.24, lng: -66.04 }];
  const tree = await render(React.createElement(NativeTransportScreen));
  assert.ok(mapMoves.some(region => region.latitude === 18.25 && region.longitude === -66.04));
  assert.ok(tree.root.findAllByType('Marker').some(marker => marker.props.title === 'Destino seleccionado'));
  params = { routeId: '1' }; await act(async () => tree.update(React.createElement(NativeTransportScreen)));
  const shape = tree.root.findByType('Polyline');
  assert.deepEqual(shape.props.coordinates, [{ latitude: 18.23, longitude: -66.05 }, { latitude: 18.24, longitude: -66.04 }]);
  assert.ok(mapMoves.some(region => region.latitude === 18.23));
});
test('vehicle link waits for hydration and positions, centers the correct vehicle and handles a new missing target', async () => {
  reset(); native.Platform.OS = 'ios'; params = { assetId: '5' };
  delete require.cache[require.resolve('../app/(tabs)/index.tsx')];
  const NativeTransportScreen = require('../app/(tabs)/index.tsx').default;
  query.positions = baseQuery(undefined); query.bootstrap = baseQuery(undefined);
  const tree = await render(React.createElement(NativeTransportScreen));
  assert.equal(tree.root.findAllByType('Modal').length, 0);
  assert.doesNotMatch(text(tree), /No hay una posición disponible para el trolley del enlace/);
  query.positions = { ...baseQuery(undefined), isLoading: true, isFetching: true };
  await act(async () => tree.update(React.createElement(NativeTransportScreen)));
  query.positions = baseQuery({ positions: [{ assetId: 5, lat: 18.24, lng: -66.06, when: new Date().toISOString() }] });
  await act(async () => tree.update(React.createElement(NativeTransportScreen)));
  assert.equal(tree.root.findAllByType('Modal').length, 1);
  assert.match(text(tree), /Trolley /);
  assert.ok(mapMoves.some(region => region.latitude === 18.24 && region.longitude === -66.06));
  await act(async () => button(tree, 'Cerrar detalle').props.onPress());
  await act(async () => tree.update(React.createElement(NativeTransportScreen)));
  assert.equal(tree.root.findAllByType('Modal').length, 0);
  params = { assetId: '7' }; await act(async () => tree.update(React.createElement(NativeTransportScreen)));
  assert.equal(tree.root.findAllByType('Modal').length, 0);
  assert.match(text(tree), /No hay una posición disponible para el trolley del enlace/);
  params = { assetId: '5', routeId: '1' }; await act(async () => tree.update(React.createElement(NativeTransportScreen)));
  assert.equal(tree.root.findAllByType('Modal').length, 1);
});

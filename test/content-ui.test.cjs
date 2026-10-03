const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const React = require('react');
const { create, act } = require('react-test-renderer');
require('./content-test-loader.cjs');
global.IS_REACT_ACT_ENVIRONMENT = true;

let params = {}; let filtersSeen; let enabledSeen = {}; let pushes = []; let opened = []; let shared = []; let alerts = []; let retried = 0;
let query; let openError = false;
const reset = () => {
  params = {}; filtersSeen = undefined; enabledSeen = {}; pushes = []; opened = []; shared = []; alerts = []; retried = 0; openError = false;
  query = { data: undefined, isLoading: false, isError: false, isFetching: false, dataUpdatedAt: Date.now(), refetch: async () => { retried++; } };
};
const queries = {};
for (const hook of ['useEventosQuery', 'useGastronomiaQuery', 'useDiscoveryQuery', 'useSearchQuery', 'useRecommendationsQuery']) {
  queries[hook] = (filters, enabled = true) => { if (hook !== 'useRecommendationsQuery') filtersSeen = filters; enabledSeen[hook] = enabled; return query; };
}
const native = {
  View: 'View', Text: 'Text', Pressable: 'Pressable', TextInput: 'TextInput', ScrollView: 'ScrollView', Image: 'Image', ActivityIndicator: 'ActivityIndicator',
  StyleSheet: { create: value => value }, Platform: { OS: 'ios' },
  Linking: { openURL: async url => { opened.push(url); if (openError) throw new Error('offline'); } },
  Share: { share: async content => { shared.push(content); } }, Alert: { alert: (...args) => alerts.push(args) },
  FlatList: ({ ListHeaderComponent, ListEmptyComponent, data, renderItem, onRefresh }) => React.createElement('FlatList', { onRefresh }, ListHeaderComponent,
    data.length ? data.map((item, index) => React.createElement(React.Fragment, { key: item.id }, renderItem({ item, index }))) : ListEmptyComponent),
};
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === 'react-native') return native;
  if (request === '@expo/vector-icons') return { Ionicons: 'Icon' };
  if (request === '@expo/vector-icons/FontAwesome') return 'Icon';
  if (request === 'expo-router') return { useRouter: () => ({ push: target => pushes.push(target), setParams: next => { params = { ...params, ...next }; } }), useLocalSearchParams: () => params };
  if (request.endsWith('/transportQueries') || request === './transportQueries') return queries;
  if (request.startsWith('@/')) return originalLoad.call(this, path.join(__dirname, '..', request.slice(2)), parent, isMain);
  return originalLoad.call(this, request, parent, isMain);
};
const { default: EventosScreen } = require('../app/(tabs)/eventos.tsx');
const { default: GastronomiaScreen } = require('../app/(tabs)/gastronomia.tsx');
const { DiscoveryFeed } = require('../components/DiscoveryFeed.tsx');
const { SearchOverlay } = require('../components/SearchOverlay.tsx');
const { RecommendationsPanel } = require('../components/RecommendationsPanel.tsx');
const { DiscoverySearch } = require('../components/DiscoverySearch.tsx');
const { FeedStatus } = require('../components/FeedStatus.tsx');
const event = { id: 'evento-1', title: 'Festival', venue: 'Teatro', category: 'Cultura', categories: ['Cultura'], summary: 'Música', description: 'Música', sourceUrl: 'https://example.com/evento', publishedAt: '2026-10-03T00:00:00.000Z', rawDate: '3 octubre 2026', imageUrl: null };
let trees = [];
afterEach(async () => { await act(async () => trees.forEach(tree => tree.unmount())); trees = []; });
async function render(component) { let tree; await act(async () => { tree = create(component); }); trees.push(tree); return tree; }
const text = tree => JSON.stringify(tree.toJSON());
const button = (tree, label) => tree.root.findAllByType('Pressable').find(node => node.props.accessibilityLabel === label);
const flushFilters = () => act(() => new Promise(resolve => setTimeout(resolve, 280)));

test('feed loading, failed fetch, retry double tap, and genuine empty have separate states', async () => {
  reset(); query.isLoading = true; query.isFetching = true;
  const tree = await render(React.createElement(EventosScreen));
  assert.match(text(tree), /Cargando…/); assert.doesNotMatch(text(tree), /No hay eventos/);
  query = { ...query, isLoading: false, isFetching: false, isError: true };
  await act(async () => tree.update(React.createElement(EventosScreen)));
  assert.match(text(tree), /No pudimos cargar el contenido/); assert.doesNotMatch(text(tree), /No hay eventos/);
  const retry = button(tree, 'Reintentar contenido');
  await act(async () => { retry.props.onPress(); retry.props.onPress(); });
  assert.equal(retried, 1);
  query = { ...query, isError: false, data: { data: [], count: 0 } };
  await act(async () => tree.update(React.createElement(EventosScreen)));
  assert.match(text(tree), /No hay eventos con esos filtros/);
});
test('cached stale records remain visible and do not look like a successful refresh', async () => {
  reset(); query.data = { data: [event], count: 1, metadata: { stale: true, complete: false }, clientCache: { source: 'local-cache', cachedAt: '2026-10-01T00:00:00Z', ageMs: 99999, networkError: 'offline' } };
  const tree = await render(React.createElement(EventosScreen));
  assert.match(text(tree), /Festival/); assert.match(text(tree), /No pudimos actualizar/); assert.match(text(tree), /catálogo está incompleto/);
  query.isFetching = true;
  await act(async () => tree.update(React.createElement(EventosScreen)));
  assert.equal(button(tree, 'Actualizar contenido').props.disabled, true);
});
test('cached empty responses after an upstream failure never claim there are no events', async () => {
  reset(); query.data = { data: [], count: 0, metadata: { stale: true, complete: false } };
  const tree = await render(React.createElement(EventosScreen));
  assert.match(text(tree), /No pudimos cargar/); assert.doesNotMatch(text(tree), /No hay eventos con esos filtros/);
});
test('deep-linked search is controlled, categories and clear update both input and query', async () => {
  reset(); params = { q: 'Festival' }; query.data = { data: [event], summary: { categories: ['Cultura'] } };
  const tree = await render(React.createElement(EventosScreen));
  assert.equal(tree.root.findByType('TextInput').props.value, 'Festival'); assert.equal(filtersSeen.q, 'Festival');
  await act(async () => button(tree, 'Filtrar eventos por Cultura').props.onPress());
  assert.equal(tree.root.findAllByType('Pressable').find(node => node.props.accessibilityLabel === 'Filtrar por categoría Cultura').props.accessibilityState.checked, true);
  await flushFilters(); assert.deepEqual(filtersSeen.category, ['Cultura']);
  await act(async () => button(tree, 'Limpiar filtros').props.onPress());
  assert.equal(tree.root.findByType('TextInput').props.value, '');
  await flushFilters(); assert.equal(filtersSeen.q, undefined); assert.equal(filtersSeen.category, undefined);
});
test('new incoming q parameters update the mounted discovery feed', async () => {
  reset(); params = { q: 'Inicial' }; query.data = { data: [], summary: { categories: [] } };
  const tree = await render(React.createElement(DiscoveryFeed));
  params = { q: 'Nuevo', category: 'Cultura,Música' };
  await act(async () => tree.update(React.createElement(DiscoveryFeed)));
  assert.equal(tree.root.findByType('TextInput').props.value, 'Nuevo');
  await flushFilters(); assert.equal(filtersSeen.q, 'Nuevo'); assert.deepEqual(filtersSeen.category, ['Cultura', 'Música']);
});
test('notification date ranges reach event queries, remain while searching, and can be cleared independently', async () => {
  reset(); params = { from: ['2026-10-03'], to: ['2026-10-04'] };
  query.data = { data: [event], summary: { categories: ['Cultura'] } };
  const tree = await render(React.createElement(EventosScreen));
  assert.equal(filtersSeen.from, '2026-10-03'); assert.equal(filtersSeen.to, '2026-10-04');
  assert.match(text(tree), /03\/10\/2026/); assert.match(text(tree), /04\/10\/2026/); assert.match(text(tree), /Puerto Rico/);
  await act(async () => tree.root.findByType('TextInput').props.onChangeText('Festival'));
  await act(async () => button(tree, 'Filtrar eventos por Cultura').props.onPress());
  await flushFilters();
  assert.equal(filtersSeen.from, '2026-10-03'); assert.equal(filtersSeen.to, '2026-10-04'); assert.equal(filtersSeen.q, 'Festival');
  await act(async () => button(tree, 'Limpiar fechas').props.onPress()); await flushFilters();
  assert.equal(filtersSeen.from, undefined); assert.equal(filtersSeen.to, undefined); assert.equal(filtersSeen.q, 'Festival'); assert.deepEqual(filtersSeen.category, ['Cultura']);
  assert.doesNotMatch(text(tree), /Puerto Rico/);
});
test('new deep-link date bounds update a mounted feed and clearing all filters resets the range', async () => {
  reset(); params = { q: 'Festival', from: '2026-10-03', to: '2026-10-04' }; query.data = { data: [] };
  const tree = await render(React.createElement(DiscoveryFeed));
  params = { q: 'Festival', from: '2026-10-05', to: '2026-10-05' };
  await act(async () => tree.update(React.createElement(DiscoveryFeed))); await flushFilters();
  assert.equal(filtersSeen.from, '2026-10-05'); assert.equal(filtersSeen.to, '2026-10-05');
  await act(async () => button(tree, 'Limpiar filtros').props.onPress()); await flushFilters();
  assert.equal(filtersSeen.from, undefined); assert.equal(filtersSeen.to, undefined); assert.equal(tree.root.findByType('TextInput').props.value, '');
});
test('clearing dates clears route params so reopening the identical notification reapplies its range', async () => {
  reset(); const notification = { from: '2026-10-03', to: '2026-10-03' }; params = { ...notification }; query.data = { data: [] };
  const tree = await render(React.createElement(EventosScreen));
  await act(async () => button(tree, 'Limpiar fechas').props.onPress()); await flushFilters();
  assert.equal(params.from, undefined); assert.equal(params.to, undefined); assert.equal(filtersSeen.from, undefined);
  params = { ...notification };
  await act(async () => tree.update(React.createElement(EventosScreen))); await flushFilters();
  assert.equal(filtersSeen.from, notification.from); assert.equal(filtersSeen.to, notification.to);
  await act(async () => button(tree, 'Limpiar filtros').props.onPress()); await flushFilters();
  assert.equal(params.q, undefined); assert.equal(params.from, undefined); assert.equal(filtersSeen.from, undefined);
});
test('invalid deep-link dates block event fetching and never expose unrestricted cached events', async () => {
  for (const range of [{ from: '2026-02-30' }, { from: '2026-10-04', to: '2026-10-03' }]) {
    reset(); params = range; query.data = { data: [event] };
    const tree = await render(React.createElement(EventosScreen));
    assert.equal(enabledSeen.useEventosQuery, false); assert.doesNotMatch(text(tree), /Festival/); assert.doesNotMatch(text(tree), /No hay eventos/);
    assert.match(text(tree), /Limpia las fechas del enlace/);
    await act(async () => tree.root.findByType('FlatList').props.onRefresh()); assert.equal(retried, 0);
    await act(async () => button(tree, 'Limpiar fechas').props.onPress()); await flushFilters();
    assert.equal(enabledSeen.useEventosQuery, true); assert.equal(filtersSeen.from, undefined); assert.equal(filtersSeen.to, undefined);
  }
});
test('gastronomy does not apply event date filters', async () => {
  reset(); params = { q: 'Café', from: 'invalid', to: '2026-10-03' }; query.data = { data: [] };
  const tree = await render(React.createElement(GastronomiaScreen));
  assert.equal(filtersSeen.q, 'Café'); assert.equal(filtersSeen.from, undefined); assert.equal(filtersSeen.to, undefined);
  assert.doesNotMatch(text(tree), /Limpiar fechas/);
});
test('event calendar button emits an all-day link once; missing date disables the action', async () => {
  reset(); query.data = { data: [event] };
  const tree = await render(React.createElement(EventosScreen));
  await act(async () => { button(tree, 'Añadir a mi calendario').props.onPress(); button(tree, 'Añadir a mi calendario').props.onPress(); });
  assert.equal(opened.length, 1); assert.equal(new URL(opened[0]).searchParams.get('dates'), '20261003/20261004');
  query.data = { data: [{ ...event, publishedAt: null }] };
  await act(async () => tree.update(React.createElement(EventosScreen)));
  assert.equal(button(tree, 'Añadir a mi calendario').props.disabled, true);
});
test('map, share, and external link failures follow real actions and show a recoverable error', async () => {
  reset(); query.data = { data: [event] };
  const mapTree = await render(React.createElement(EventosScreen));
  await act(async () => button(mapTree, 'Buscar ubicación en el mapa de transporte').props.onPress());
  assert.deepEqual(pushes, [{ pathname: '/', params: { q: 'Teatro' } }]);
  const shareTree = await render(React.createElement(EventosScreen));
  await act(async () => button(shareTree, 'Compartir este evento').props.onPress());
  assert.equal(shared.length, 1); assert.match(shared[0].message, /Festival/); assert.equal(shared[0].url, event.sourceUrl);
  openError = true;
  const errorTree = await render(React.createElement(EventosScreen));
  await act(async () => errorTree.root.findAllByType('Pressable').find(node => node.props.accessibilityRole === 'link').props.onPress());
  assert.equal(alerts.length, 1); assert.match(alerts[0][0], /No pudimos abrir/);
});
test('gastronomy featured places and suggested routes actually filter the feed', async () => {
  reset(); query.data = { data: [], summary: { categories: [], featuredPlaces: [{ id: 'food-1', title: 'Restaurante', category: 'Criolla', reason: 'Popular' }], suggestedRoutes: [{ id: 'route-1', title: 'Sabores', description: 'Ruta', count: 2, categories: ['Criolla', 'Café'] }] } };
  const tree = await render(React.createElement(GastronomiaScreen));
  await act(async () => button(tree, 'Ver detalles de Restaurante').props.onPress());
  assert.equal(tree.root.findByType('TextInput').props.value, 'Restaurante'); await flushFilters(); assert.equal(filtersSeen.q, 'Restaurante');
  await act(async () => button(tree, 'Explorar Sabores').props.onPress()); await flushFilters();
  assert.deepEqual(filtersSeen.category, ['Criolla', 'Café']); assert.equal(tree.root.findByType('TextInput').props.value, '');
});
test('search supports initial q, explicit close/back, selection double taps, and error retry', async () => {
  reset(); let closed = 0; let selected = 0;
  const props = { initialQuery: 'Trolley', onClose: () => closed++, onResultPress: () => selected++ };
  query.data = { results: [{ id: 'stop-12', type: 'stop', title: 'Plaza', subtitle: 'Parada' }] };
  const tree = await render(React.createElement(SearchOverlay, props));
  assert.equal(filtersSeen, 'Trolley');
  await act(async () => { button(tree, 'Parada: Plaza').props.onPress(); button(tree, 'Parada: Plaza').props.onPress(); });
  assert.equal(selected, 1);
  await act(async () => button(tree, 'Cerrar búsqueda').props.onPress()); assert.equal(closed, 1);
  query.isError = true; query.data = undefined;
  await act(async () => tree.update(React.createElement(SearchOverlay, props)));
  assert.match(text(tree), /No pudimos cargar/); assert.doesNotMatch(text(tree), /No encontramos resultados/);
});
test('internal recommendation buttons are visible and navigate within the app', async () => {
  reset(); query.data = { data: [{ id: 'r1', type: 'food', priority: 'high', title: 'Comer', message: 'Explorar', actionLabel: 'Ver lugares', actionHref: '/gastronomia?category=Criolla', evidence: [] }] };
  const tree = await render(React.createElement(RecommendationsPanel));
  await act(async () => button(tree, 'Ver lugares').props.onPress());
  assert.deepEqual(pushes, [{ pathname: '/gastronomia', params: { category: 'Criolla' } }]);
});

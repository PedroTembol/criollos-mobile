import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { useRouter, useLocalSearchParams } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { useFavorites } from '@/components/transportFavorites';
import { formatDistance, sortByDistance, type LatLng } from '@/components/transportGeo';
import { etaCoordinates, positionFreshness, positiveId, resolveRouteId, resolveStop, validCoordinates } from '@/components/transportContracts';
import {
  useBootstrapQuery,
  useEtaQuery,
  useNearbyStopsQuery,
  usePositionsQuery,
  useRoutesQuery,
  useStopsQuery,
  useTrackingQuery,
  useDiscoveryQuery,
} from '@/components/transportQueries';
import { planRoute, type RoutePlan } from '@/components/transportPlanner';
import type { Marker as ApiMarker, Position, Route, RoutePoint } from '@/components/transportTypes';
import { TrackingDashboard } from '@/components/TrackingDashboard';
import { NearbyStopsPanel } from '@/components/NearbyStopsPanel';
import { SearchOverlay } from '@/components/SearchOverlay';
import type { SearchResult } from '@/components/transportTypes';

type ViewMode = 'mapa' | 'lista' | 'planner';

type LocationChoice = {
  id: string;
  label: string;
  lat: number;
  lng: number;
  type: 'stop' | 'marker';
};

type EtaLine = {
  label: string;
  value: string;
};

const CAGUAS_CENTER = { latitude: 18.2341, longitude: -66.0485 };
const isWeb = Platform.OS === 'web';
const mapsModule = isWeb ? null : require('react-native-maps');
const MapView = mapsModule?.default as any;
const Marker = mapsModule?.Marker as any;
const Polyline = mapsModule?.Polyline as any;

function humanizeKey(input: string) {
  return input
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

function formatEtaValue(value: unknown): string {
  if (value == null) return 'N/D';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return 'N/D';
    if (value >= 60 && value % 60 === 0) {
      return `${Math.round(value / 60)} min`;
    }
    if (value > 0 && value < 60) {
      return `${Math.round(value)} s`;
    }
    return String(Math.round(value * 100) / 100);
  }
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return 'N/D';
    const isoDate = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(trimmed);
    if (isoDate) {
      const parsed = new Date(trimmed);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toLocaleString('es-PR', {
          hour: 'numeric',
          minute: '2-digit',
          month: 'short',
          day: 'numeric',
        });
      }
    }
    return trimmed;
  }
  if (Array.isArray(value)) {
    return value.map((item) => formatEtaValue(item)).join(', ');
  }
  return JSON.stringify(value);
}

function flattenEta(data: unknown, prefix?: string): EtaLine[] {
  if (!data || typeof data !== 'object') return [];

  return Object.entries(data as Record<string, unknown>).flatMap(([key, value]) => {
    const label = prefix ? `${prefix} · ${humanizeKey(key)}` : humanizeKey(key);

    if (Array.isArray(value)) {
      if (value.length === 0) return [];
      if (value.every((item) => item == null || typeof item !== 'object')) {
        return [{ label, value: formatEtaValue(value) }];
      }
      return value.flatMap((item, index) => flattenEta(item, `${label} ${index + 1}`));
    }

    if (value && typeof value === 'object') {
      return flattenEta(value, label);
    }

    return [{ label, value: formatEtaValue(value) }];
  });
}

function formatLastUpdated(value?: string | number | null) {
  if (!value) return 'Sin sincronizar';
  const parsed = typeof value === 'number' ? new Date(value) : new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Sin sincronizar';
  return parsed.toLocaleTimeString('es-PR', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Puerto_Rico',
  });
}

export default function TransportScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const bootstrapQuery = useBootstrapQuery();
  const routesQuery = useRoutesQuery();
  const stopsQuery = useStopsQuery();
  const positionsQuery = usePositionsQuery();
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('mapa');
  const [searchText, setSearchText] = useState('');
  const [radiusMeters, setRadiusMeters] = useState(600);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'granted' | 'denied'>(
    'idle',
  );
  const [locationError, setLocationError] = useState<string | null>(null);

  const trackingQuery = useTrackingQuery();
  const nearbyStopsQuery = useNearbyStopsQuery(userLocation?.lat, userLocation?.lng, { limit: 5 });
  const { loaded: favoritesLoaded, storageError: favoritesStorageError, favorites, toggleStopFavorite, isStopFavorite } = useFavorites();

  const [selectedStop, setSelectedStop] = useState<RoutePoint | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [highlightedRouteId, setHighlightedRouteId] = useState<number | null>(null);
  const [mapTarget, setMapTarget] = useState<LatLng | null>(null);
  const [navigationMessage, setNavigationMessage] = useState<string | null>(null);
  const mapRef = useRef<any>(null);
  const locationPending = useRef(false);
  const refreshPending = useRef(false);
  const lastDeepLink = useRef<string | null>(null);
  const [now, setNow] = useState(Date.now());


  const discoveryNearbyQuery = useDiscoveryQuery({
    lat: selectedStop?.lat,
    lng: selectedStop?.lng,
    radiusMeters: 500,
    limit: 6
  }, Boolean(selectedStop));

  const [selectedTrolley, setSelectedTrolley] = useState<Position | null>(null);
  const [showEta, setShowEta] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const [originChoice, setOriginChoice] = useState<LocationChoice | null>(null);
  const [destinationChoice, setDestinationChoice] = useState<LocationChoice | null>(null);
  const [originQuery, setOriginQuery] = useState('');
  const [plannerQuery, setPlannerQuery] = useState('');
  const [planResult, setPlanResult] = useState<RoutePlan | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);

  const stops = stopsQuery.data?.stops ?? bootstrapQuery.data?.stops ?? [];
  const routePoints = bootstrapQuery.data?.routePoints ?? [];
  const markers = bootstrapQuery.data?.markers ?? [];
  const routes = routesQuery.data?.routes ?? bootstrapQuery.data?.routes ?? [];
  const positions = positionsQuery.data?.positions ?? bootstrapQuery.data?.positions ?? [];
  const usingBootstrapPositions = !positionsQuery.data;
  const catalogueResponses = [bootstrapQuery.data, stopsQuery.data, routesQuery.data].filter(Boolean);
  const cachedCatalogue = catalogueResponses.filter((data) => data?.clientCache?.source === 'local-cache').sort((a, b) => Date.parse(a!.clientCache!.cachedAt) - Date.parse(b!.clientCache!.cachedAt))[0];
  const transportIsCached = Boolean(cachedCatalogue);
  const telemetryIsStale = positionsQuery.data?.stale || positionsQuery.data?.metadata?.stale || (usingBootstrapPositions && (bootstrapQuery.data?.stale || bootstrapQuery.data?.clientCache?.source === 'local-cache'));
  const livePositions = telemetryIsStale ? [] : positions.filter((position) => positionFreshness(position, now) === 'live' && validCoordinates(position.lat, position.lng));


  // Encontrar el trolley más cercano para el ETA si hay una parada seleccionada
  const nearestTrolleyForStop = useMemo(() => {
    if (!selectedStop || livePositions.length === 0) return null;
    const active = livePositions.filter((p) => p.routeId === selectedStop.routeId);
    if (active.length === 0) return null;

    const sorted = sortByDistance(active, (p) => ({ lat: p.lat!, lng: p.lng! }), {
      lat: selectedStop.lat,
      lng: selectedStop.lng,
    });
    return sorted[0]?.item ?? null;
  }, [selectedStop, positions, now, telemetryIsStale]);

  const etaQuery = useEtaQuery(
    {
      assetId: nearestTrolleyForStop?.assetId,
      stopId: selectedStop?.id,
      latlngs: etaCoordinates(nearestTrolleyForStop, selectedStop),
    },
    showEta
  );

  const markersById = useMemo(() => {
    const map = new Map<number, ApiMarker>();
    markers.forEach((marker) => {
      map.set(marker.id, marker);
    });
    return map;
  }, [markers]);

  const stopLabel = (stop: RoutePoint) => {
    if (stop.markerId != null) {
      const marker = markersById.get(stop.markerId);
      if (marker?.description) return marker.description;
    }
    return `Parada ${stop.id}`;
  };

  const filteredStops = useMemo(() => {
    const lower = searchText.trim().toLowerCase();
    if (!lower) return stops;
    return stops.filter((stop) => stopLabel(stop).toLowerCase().includes(lower));
  }, [searchText, stops]);

  const activePositions = positions.filter((pos) => validCoordinates(pos.lat, pos.lng));

  const apiError =
    bootstrapQuery.error ||
    stopsQuery.error ||
    routesQuery.error ||
    positionsQuery.error ||
    trackingQuery.error;
    // Quitamos etaQuery.error de aquí para que no bloquee el UI principal


  const etaLines = useMemo(() => typeof etaQuery.data?.total_seconds === 'number' && etaQuery.data.total_seconds >= 0
    ? [{ label: 'Recorrido aproximado', value: `${Math.max(1, Math.ceil(etaQuery.data.total_seconds / 60))} min` }]
    : flattenEta(etaQuery.data), [etaQuery.data]);

  const requestLocation = async () => {
    if (locationPending.current) return;
    locationPending.current = true;
    try {
      setLocationStatus('loading');
      setLocationError(null);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationStatus('denied');
        setLocationError('Necesitamos permiso de ubicación para mostrar paradas cercanas.');
        return;
      }
      const current = await Location.getCurrentPositionAsync({});
      setUserLocation({ lat: current.coords.latitude, lng: current.coords.longitude });
      setLocationStatus('granted');
    } catch {
      setLocationStatus('idle');
      setLocationError('No pudimos obtener tu ubicación ahora mismo. Inténtalo de nuevo.');
    } finally {
      locationPending.current = false;
    }
  };

  const nearbyStops = useMemo(() => {
    if (!userLocation) return [];
    return sortByDistance(
      stops,
      (stop) => ({ lat: stop.lat, lng: stop.lng }),
      userLocation,
    ).filter((entry) => entry.distance <= radiusMeters);
  }, [radiusMeters, stops, userLocation]);

  const planOptions = useMemo<LocationChoice[]>(() => {
    const stopChoices = stops.map((stop) => ({
      id: `stop:${stop.id}`,
      label: stopLabel(stop),
      lat: stop.lat,
      lng: stop.lng,
      type: 'stop' as const,
    }));
    const markerChoices = markers
      .filter((marker) => validCoordinates(marker.lat, marker.lng))
      .map((marker) => ({
        id: `marker:${marker.id}`,
        label: marker.description || `Lugar ${marker.id}`,
        lat: marker.lat as number,
        lng: marker.lng as number,
        type: 'marker' as const,
      }));
    return [...stopChoices, ...markerChoices];
  }, [markers, stops]);

  const plannerResults = useMemo(() => {
    const lower = plannerQuery.trim().toLowerCase();
    if (!lower) return planOptions.slice(0, 8);
    return planOptions.filter((option) => option.label.toLowerCase().includes(lower)).slice(0, 8);
  }, [planOptions, plannerQuery]);

  const originResults = useMemo(() => {
    const lower = originQuery.trim().toLowerCase();
    if (!lower) return planOptions.slice(0, 6);
    return planOptions.filter((option) => option.label.toLowerCase().includes(lower)).slice(0, 6);
  }, [originQuery, planOptions]);

  const isRefreshing =
    bootstrapQuery.isFetching ||
    routesQuery.isFetching ||
    stopsQuery.isFetching ||
    positionsQuery.isFetching ||
    trackingQuery.isFetching;

  const latestFetchAt = positionsQuery.data?.fetchedAt ?? bootstrapQuery.data?.fetchedAt ??
    bootstrapQuery.data?.clientCache?.cachedAt;
  const transportStatus = transportIsCached ? 'Copia guardada' : catalogueResponses.some((data) => data?.stale || data?.metadata?.stale) ? 'Datos anteriores del servidor' : 'Datos de transporte';
  const lastPositionAt = activePositions
    .map((position) => position.when).filter((when): when is string => Boolean(when && Number.isFinite(Date.parse(when))))
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0];
  const refreshAllData = async () => {
    if (refreshPending.current) return;
    refreshPending.current = true;
    try {
      await Promise.all([
        bootstrapQuery.refetch(), routesQuery.refetch(), stopsQuery.refetch(),
        positionsQuery.refetch(), trackingQuery.refetch(),
      ]);
    } finally { refreshPending.current = false; }
  };

  const calculatePlan = () => {
    setPlanError(null);
    if (!userLocation && !originChoice) {
      setPlanError('Necesitas ubicación u origen seleccionado.');
      return;
    }
    if (!destinationChoice || routePoints.length === 0) {
      setPlanError('Selecciona un destino y espera datos de rutas.');
      return;
    }
    const origin = originChoice ??
      (userLocation
        ? { ...userLocation, id: 'me', label: 'Mi ubicación', type: 'stop' as const }
        : null);
    if (!origin) return;
    const result = planRoute(
      { lat: origin.lat, lng: origin.lng },
      { lat: destinationChoice.lat, lng: destinationChoice.lng },
      routePoints,
    );
    if (!result) {
      setPlanError('No se encontró una ruta con los datos actuales.');
    }
    setPlanResult(result);
  };

  const selectedRoutes = useMemo(() => {
    if (!selectedStop?.routeId) return [];
    return routes.filter((route) => route.id === selectedStop.routeId);
  }, [routes, selectedStop]);

  const closeModal = () => {
    setSelectedStop(null);
    setSelectedTrolley(null);
    setSelectedRoute(null);
    setShowEta(false);
  };

  const selectStop = (stop: RoutePoint) => {
    setSelectedStop(stop);
    setSelectedTrolley(null);
    setSelectedRoute(null);
    setShowEta(false);
    setMapTarget({ lat: stop.lat, lng: stop.lng });
    setNavigationMessage(null);
  };

  const selectRoute = (routeId: number) => {
    const route = routes.find((item) => item.id === routeId);
    if (!route) { setNavigationMessage('Esta ruta no está disponible en los datos cargados.'); return; }
    closeModal();
    setSelectedRoute(route);
    setHighlightedRouteId(routeId);
    setViewMode('mapa');
    const point = routePoints.find((item) => item.routeId === routeId);
    if (point) setMapTarget({ lat: point.lat, lng: point.lng });
    setNavigationMessage(null);
  };

  const selectTrolley = (vehicle: Position) => {
    closeModal();
    setSelectedTrolley(vehicle);
    setViewMode('mapa');
    setMapTarget(validCoordinates(vehicle.lat, vehicle.lng)
      ? { lat: vehicle.lat!, lng: vehicle.lng! } : null);
    setNavigationMessage(null);
  };

  const handleSearchResult = (result: SearchResult) => {
    setIsSearching(false);
    if (result.type === 'stop') {
      const stop = resolveStop(result, stops);
      if (stop) { selectStop(stop); setViewMode('mapa'); }
      else setNavigationMessage('Esta parada no está disponible en los datos cargados. Actualiza e inténtalo de nuevo.');
    } else if (result.type === 'route') {
      const routeId = resolveRouteId(result);
      if (routeId) selectRoute(routeId);
    } else if (result.type === 'vehicle') {
      const vehicle = positions.find((item) => item.assetId === positiveId(result.metadata?.assetId));
      if (vehicle) selectTrolley(vehicle);
      else setNavigationMessage('No hay una posición disponible para este trolley.');
    } else if (result.type === 'evento') {
      router.push({ pathname: '/eventos' as any, params: { q: result.title } });
    } else if (result.type === 'gastronomia') {
      router.push({ pathname: '/gastronomia' as any, params: { q: result.title } });
    }
  };

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => { setPlanResult(null); setPlanError(null); }, [originChoice, destinationChoice, userLocation, routePoints]);

  useEffect(() => {
    if (viewMode === 'mapa' && mapTarget) mapRef.current?.animateToRegion({ latitude: mapTarget.lat, longitude: mapTarget.lng, latitudeDelta: 0.012, longitudeDelta: 0.012 }, 350);
  }, [mapTarget, viewMode]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isSearching) { setIsSearching(false); return true; }
      return false;
    });
    return () => subscription.remove();
  }, [isSearching]);

  // Resolve deep links once per URL, once the required catalogue is available.
  useEffect(() => {
    const scalar = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
    const signature = JSON.stringify([params.stopId, params.routePointId, params.routeId, params.assetId, params.lat, params.lng, params.q]);
    if (signature === lastDeepLink.current) return;
    const stopId = positiveId(scalar(params.stopId as any));
    const routePointId = positiveId(scalar(params.routePointId as any));
    const routeId = positiveId(scalar(params.routeId as any));
    const assetId = positiveId(scalar(params.assetId as any));
    if ((stopId || routePointId) && stops.length === 0) return;
    if (routeId && !assetId && routes.length === 0) return;
    if (assetId && !positionsQuery.data && !bootstrapQuery.data && !positionsQuery.error && !bootstrapQuery.error) return;
    if (assetId && (positionsQuery.isLoading || positionsQuery.isFetching) && !positions.some((vehicle) => vehicle.assetId === assetId)) return;
    if (stopId || routePointId) {
      const match = resolveStop({ id: '', metadata: { stopId, routePointId } }, stops);
      if (match) { selectStop(match); setViewMode('mapa'); }
      else setNavigationMessage('La parada del enlace no está disponible.');
    } else if (assetId) {
      const vehicle = positions.find((item) => item.assetId === assetId);
      if (vehicle) selectTrolley(vehicle);
      else {
        closeModal();
        setMapTarget(null);
        setNavigationMessage('No hay una posición disponible para el trolley del enlace. Actualiza e inténtalo de nuevo.');
      }
    } else if (routeId) {
      selectRoute(routeId);
    } else {
      const lat = Number(scalar(params.lat as any));
      const lng = Number(scalar(params.lng as any));
      if (params.lat !== undefined && params.lng !== undefined && validCoordinates(lat, lng)) {
        setViewMode('mapa');
        setMapTarget({ lat, lng });
        const stop = stops.find((item) => Math.abs(item.lat - lat) < 0.0001 && Math.abs(item.lng - lng) < 0.0001);
        if (stop) selectStop(stop);
      } else if (params.q) {
        setSearchText(scalar(params.q as any) ?? '');
        setIsSearching(true);
      }
    }
    lastDeepLink.current = signature;
  }, [params.stopId, params.routePointId, params.routeId, params.assetId, params.lat, params.lng, params.q, stops, routes, positions, positionsQuery.isLoading, positionsQuery.isFetching, positionsQuery.error, bootstrapQuery.error]);

  // Intentar obtener ubicación al montar para mostrar paradas cercanas
  useEffect(() => {
    if (!userLocation && !isWeb && locationStatus === 'idle') {
      requestLocation();
    }
  }, []);

  return (
    <View style={styles.container}>
      <View
        style={styles.statusCard}
        accessibilityRole="summary"
        accessibilityLabel={`Datos de transporte. ${livePositions.length} trolleys con señal reciente, ${stops.length} paradas cargadas y ${routes.length} rutas disponibles. Última actualización ${formatLastUpdated(latestFetchAt)}.`}>
        <View style={styles.statusHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.statusEyebrow}>{transportStatus}</Text>
            <Text style={styles.statusTitle}>Red de transporte de Caguas</Text>
            <Text style={styles.statusMeta}>Última consulta: {formatLastUpdated(latestFetchAt)}</Text>
            <Text style={styles.statusMeta}>Última posición: {formatLastUpdated(lastPositionAt)}</Text>
            {transportIsCached && <Text style={styles.statusMeta}>Sin conexión: copia de {new Date(cachedCatalogue!.clientCache!.cachedAt).toLocaleString('es-PR')}. Puede estar desactualizada.</Text>}
          </View>
          <View style={{ gap: 8, flexDirection: 'row' }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Buscar en Criollos"
              style={[styles.refreshButton, { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1' }]}
              onPress={() => setIsSearching((previous) => !previous)}>
              <FontAwesome name="search" size={16} color="#475569" />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Actualizar datos de transporte"
              style={[styles.refreshButton, isRefreshing && styles.refreshButtonDisabled]}
              onPress={refreshAllData}
              disabled={isRefreshing}>
              <FontAwesome name="refresh" size={16} color="#fff" />
            </Pressable>
          </View>
        </View>

        {isSearching && (
          <View style={{ marginTop: 12 }}>
            <SearchOverlay 
              initialQuery={searchText}
              onResultPress={handleSearchResult} 
              onClose={() => setIsSearching(false)} 
            />
          </View>
        )}

        <View style={styles.statusStatsRow}>
          <View style={styles.statusStat}>
            <Text style={styles.statusStatValue}>{livePositions.length}</Text>
            <Text style={styles.statusStatLabel}>Señal reciente</Text>
          </View>
          <View style={styles.statusStat}>
            <Text style={styles.statusStatValue}>{stops.length}</Text>
            <Text style={styles.statusStatLabel}>Paradas</Text>
          </View>
          <View style={styles.statusStat}>
            <Text style={styles.statusStatValue}>{routes.length}</Text>
            <Text style={styles.statusStatLabel}>Rutas</Text>
          </View>
        </View>
      </View>

      <View style={styles.quickActionsCard}>
        <Text style={styles.quickActionsTitle}>Moverme por Criollos</Text>
        <Text style={styles.quickActionsText}>
          Busca una parada, consulta el trazado y planifica cómo llegar.
        </Text>
        <View style={styles.quickActionsRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Abrir pestaña Eventos"
            style={styles.quickActionButton}
            onPress={() => router.push('/(tabs)/eventos' as never)}>
            <Text style={styles.quickActionButtonText}>Ir a Eventos</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Abrir pestaña Gastronomía"
            style={styles.quickActionGhostButton}
            onPress={() => router.push('/(tabs)/gastronomia' as never)}>
            <Text style={styles.quickActionGhostText}>Ver Gastronomía</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.toggleRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ver mapa del transporte"
          accessibilityState={{ selected: viewMode === 'mapa' }}
          style={[styles.toggleButton, viewMode === 'mapa' && styles.toggleButtonActive]}
          onPress={() => setViewMode('mapa')}>
          <Text style={styles.toggleText}>Mapa</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ver lista de trolleys y paradas"
          accessibilityState={{ selected: viewMode === 'lista' }}
          style={[styles.toggleButton, viewMode === 'lista' && styles.toggleButtonActive]}
          onPress={() => setViewMode('lista')}>
          <Text style={styles.toggleText}>Lista</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Planificar una ruta"
          accessibilityState={{ selected: viewMode === 'planner' }}
          style={[styles.toggleButton, viewMode === 'planner' && styles.toggleButtonActive]}
          onPress={() => setViewMode('planner')}>
          <Text style={styles.toggleText}>Ruta</Text>
        </Pressable>
      </View>
      {bootstrapQuery.isLoading && <View style={styles.errorBanner}><ActivityIndicator /><Text style={styles.helperText}>Cargando catálogo de transporte...</Text></View>}
      {navigationMessage && <Text style={styles.helperText}>{navigationMessage}</Text>}
      {Boolean(apiError) && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{apiError instanceof Error ? apiError.message : 'No se pudo actualizar el transporte.'} Los datos anteriores pueden estar desactualizados.</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reintentar carga de datos de transporte"
            style={styles.errorRetryButton}
            onPress={refreshAllData}
            disabled={isRefreshing}>
            <Text style={styles.errorRetryText}>Reintentar</Text>
          </Pressable>
        </View>
      )}

      {viewMode === 'mapa' && (
        <View style={styles.mapWrap}>
          {isWeb ? (
            <View style={styles.webMapFallback}>
              <Text style={styles.sectionTitle}>Mapa interactivo disponible en iOS y Android</Text>
              <Text style={styles.helperText}>
                Consulta las paradas, abre una ruta o usa la lista para planificar tu viaje.
              </Text>
              <View style={styles.statusStatsRow}>
                <View style={styles.statusStat}>
                  <Text style={styles.statusStatValue}>{activePositions.length}</Text>
                  <Text style={styles.statusStatLabel}>Posiciones reportadas</Text>
                </View>
                <View style={styles.statusStat}>
                  <Text style={styles.statusStatValue}>{stops.length}</Text>
                  <Text style={styles.statusStatLabel}>Paradas</Text>
                </View>
              </View>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Paradas destacadas</Text>
                {stops.slice(0, 6).map((stop) => (
                  <Pressable
                    key={`web-stop-${stop.id}`}
                    onPress={() => selectStop(stop)}
                    accessibilityRole="button"
                    accessibilityLabel={`${stopLabel(stop)}, ruta ${stop.routeId ?? 'N/A'}`}>
                    <View style={styles.listItem}>
                      <Text style={styles.listTitle}>{stopLabel(stop)}</Text>
                      <Text style={styles.listMeta}>Ruta {stop.routeId ?? 'N/A'}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            <>
              <MapView
                ref={mapRef}
                style={styles.map}
                accessibilityLabel="Mapa de trolleys y paradas de Caguas"
                initialRegion={{ latitude: mapTarget?.lat ?? CAGUAS_CENTER.latitude, longitude: mapTarget?.lng ?? CAGUAS_CENTER.longitude, latitudeDelta: 0.07, longitudeDelta: 0.07 }}
                showsUserLocation>
                {mapTarget && <Marker coordinate={{ latitude: mapTarget.lat, longitude: mapTarget.lng }} title="Destino seleccionado" pinColor="#16a34a" />}
                {[0, 1].map((direction) => {
                  const points = routePoints.filter((point) => point.routeId === highlightedRouteId && point.direction === direction).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
                  return points.length > 1 ? <Polyline key={`route-shape-${direction}`} coordinates={points.map((point) => ({ latitude: point.lat, longitude: point.lng }))} strokeWidth={4} strokeColor="#2563eb" /> : null;
                })}
                {stops.map((stop) => (
                  <Marker
                    key={`stop-${stop.id}`}
                    coordinate={{ latitude: stop.lat, longitude: stop.lng }}
                    title={stopLabel(stop)}
                    description={`Ruta ${stop.routeId ?? 'N/A'}`}
                    pinColor="#1d4ed8"
                    onPress={() => selectStop(stop)}
                  />
                ))}
                {activePositions.map((pos) => (
                  <Marker
                    key={`pos-${pos.assetId ?? `${pos.lat}-${pos.lng}`}`}
                    coordinate={{ latitude: pos.lat as number, longitude: pos.lng as number }}
                    title={`Trolley ${pos.assetId ?? ''} · ${positionFreshness(pos, now) === 'live' && !telemetryIsStale ? 'señal reciente' : 'posición anterior'}`}
                    description={`Ruta ${pos.routeId ?? 'N/A'}`}
                    pinColor="#dc2626"
                    onPress={() => setSelectedTrolley(pos)}
                  />
                ))}
              </MapView>

              <View style={styles.dashboardOverlay}>
                <TrackingDashboard
                  snapshot={trackingQuery.isError || trackingQuery.data?.stale || trackingQuery.data?.metadata?.stale ? undefined : trackingQuery.data}
                  onRoutePress={selectRoute}
                />
              </View>

              <View style={styles.nearbyOverlay}>
                <NearbyStopsPanel 
                  stops={nearbyStopsQuery.data?.data}
                  isLoading={nearbyStopsQuery.isLoading}
                  isError={nearbyStopsQuery.isError}
                  onRetry={() => nearbyStopsQuery.refetch()}
                  onStopPress={(stop) => {
                    const stopObj = stops.find(s => s.markerId === stop.markerId);
                    if (stopObj) selectStop(stopObj);
                  }}
                />
              </View>

              {isRefreshing && (
                <View style={styles.mapLoadingOverlay} pointerEvents="none">
                  <ActivityIndicator color="#2563eb" />
                  <Text style={styles.mapLoadingText}>Sincronizando transporte...</Text>
                </View>
              )}
            </>
          )}
        </View>
      )}

      {viewMode === 'lista' && (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar paradas..."
              accessibilityLabel="Buscar paradas"
              accessibilityHint="Filtra la lista de paradas por nombre"
              value={searchText}
              onChangeText={setSearchText}
            />
          </View>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cerca de mí</Text>
            <Pressable
              style={styles.primaryButton}
              onPress={requestLocation}
              disabled={locationStatus === 'loading'}
              accessibilityRole="button"
              accessibilityLabel="Actualizar ubicación actual">
              <Text style={styles.primaryButtonText}>
                {locationStatus === 'loading' ? 'Buscando...' : 'Actualizar ubicación'}
              </Text>
            </Pressable>
            <View style={styles.radiusRow}>
              <Text style={styles.helperText}>Radio (m):</Text>
              <TextInput
                style={styles.radiusInput}
                value={String(radiusMeters)}
                keyboardType="numeric"
                accessibilityLabel="Radio de búsqueda en metros"
                onChangeText={(value) => {
                  const parsed = Number.parseInt(value, 10);
                  if (!Number.isNaN(parsed)) setRadiusMeters(Math.min(10000, Math.max(50, parsed)));
                }}
              />
            </View>
            {locationError && <Text style={styles.helperText}>{locationError}</Text>}
            {userLocation ? (
              nearbyStops.length > 0 ? (
                nearbyStops.map(({ item, distance }) => (
                  <Pressable
                    key={`nearby-${item.id}`}
                    onPress={() => selectStop(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`${stopLabel(item)}, a ${formatDistance(distance)}`}>
                    <View style={styles.listItem}>
                      <Text style={styles.listTitle}>{stopLabel(item)}</Text>
                      <Text style={styles.listMeta}>{formatDistance(distance)}</Text>
                    </View>
                  </Pressable>
                ))
              ) : (
                <Text style={styles.helperText}>No hay paradas cerca en ese radio.</Text>
              )
            ) : (
              <Text style={styles.helperText}>Activa ubicación para ver paradas cercanas.</Text>
            )}
          </View>

          {favorites.stopIds.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Favoritas</Text>
              {favorites.stopIds
                .map((stopId) => stops.find((stop) => stop.id === stopId))
                .filter(Boolean)
                .map((stop) => (
                  <Pressable
                    key={`fav-stop-${stop?.id}`}
                    onPress={() => stop && selectStop(stop)}
                    accessibilityRole="button"
                    accessibilityLabel={stop ? `Abrir parada favorita ${stopLabel(stop)}` : 'Abrir parada favorita'}>
                    <View style={styles.listItem}>
                      <Text style={styles.listTitle}>{stop ? stopLabel(stop) : 'Parada'}</Text>
                    </View>
                  </Pressable>
                ))}
            </View>
          )}
          <Text style={styles.sectionTitle}>Últimas posiciones reportadas</Text>
          {positionsQuery.isLoading ? (
            <ActivityIndicator />
          ) : activePositions.length > 0 ? (
            activePositions.map((pos) => (
              <Pressable
                key={`list-pos-${pos.assetId ?? `${pos.lat}-${pos.lng}`}`}
                onPress={() => setSelectedTrolley(pos)}
                accessibilityRole="button"
                accessibilityLabel={`Trolley ${pos.assetId ?? 'N/A'}, ruta ${pos.routeId ?? 'N/A'}`}>
                <View style={styles.listItem}>
                  <Text style={styles.listTitle}>Trolley {pos.assetId ?? 'N/A'}</Text>
                  <Text style={styles.listMeta}>Ruta {pos.routeId ?? 'N/A'} · {positionFreshness(pos, now) === 'live' && !telemetryIsStale ? 'Señal reciente' : 'Posición anterior'}</Text>
                </View>
              </Pressable>
            ))
          ) : (
            <Text style={styles.helperText}>No hay posiciones reportadas en esta consulta. Esto no confirma si el servicio está operando.</Text>
          )}

          <Text style={styles.sectionTitle}>Rutas del catálogo</Text>
          {routes.map((route) => (
            <Pressable key={`route-list-${route.id}`} onPress={() => selectRoute(route.id)} accessibilityRole="button" accessibilityLabel={`Abrir ${route.description || `Ruta ${route.id}`}`} style={styles.listItem}>
              <Text style={styles.listTitle}>{route.description || `Ruta ${route.id}`}</Text>
              <Text style={styles.listMeta}>{route.directionStartName} → {route.directionEndName}</Text>
            </Pressable>
          ))}
          <Text style={styles.sectionTitle}>Paradas</Text>
          {filteredStops.length > 0 ? (
            filteredStops.map((stop) => (
              <Pressable
                key={`list-stop-${stop.id}`}
                onPress={() => selectStop(stop)}
                accessibilityRole="button"
                accessibilityLabel={`${stopLabel(stop)}, ruta ${stop.routeId ?? 'N/A'}`}>
                <View style={styles.listItem}>
                  <Text style={styles.listTitle}>{stopLabel(stop)}</Text>
                  <Text style={styles.listMeta}>Ruta {stop.routeId ?? 'N/A'}</Text>
                </View>
              </Pressable>
            ))
          ) : (
            <Text style={styles.helperText}>No encontramos paradas con ese filtro.</Text>
          )}
        </ScrollView>
      )}

      {viewMode === 'planner' && (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ubicación</Text>
            <Pressable
              style={styles.primaryButton}
              onPress={requestLocation}
              disabled={locationStatus === 'loading'}
              accessibilityRole="button"
              accessibilityLabel="Usar mi ubicación actual para planificar ruta">
              <Text style={styles.primaryButtonText}>
                {locationStatus === 'loading' ? 'Buscando...' : 'Usar mi ubicación'}
              </Text>
            </Pressable>
            {userLocation && (
              <Text style={styles.helperText}>
                Ubicación actual: {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
              </Text>
            )}
            {locationStatus === 'denied' && (
              <Text style={styles.helperText}>Permiso denegado. Habilítalo en Ajustes.</Text>
            )}
            {locationError && <Text style={styles.helperText}>{locationError}</Text>}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Origen (opcional)</Text>
            {originChoice ? (
              <View style={styles.selectedChip}>
                <Text>{originChoice.label}</Text>
                <Pressable onPress={() => setOriginChoice(null)} accessibilityRole="button" accessibilityLabel="Quitar origen seleccionado">
                  <Text style={styles.linkText}>Quitar</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <Text style={styles.helperText}>Si no eliges origen, usamos tu ubicación.</Text>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar origen (parada o lugar)"
                  accessibilityLabel="Buscar origen"
                  value={originQuery}
                  onChangeText={setOriginQuery}
                />
                {originResults.map((option) => (
                  <Pressable
                    key={`origin-${option.id}`}
                    onPress={() => {
                      setOriginChoice(option);
                      setOriginQuery('');
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Seleccionar origen ${option.label}`}>
                    <View style={styles.listItem}>
                      <Text style={styles.listTitle}>{option.label}</Text>
                      <Text style={styles.listMeta}>{option.type === 'stop' ? 'Parada' : 'Lugar'}</Text>
                    </View>
                  </Pressable>
                ))}
              </>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Destino</Text>
            {destinationChoice ? (
              <View style={styles.selectedChip}>
                <Text>{destinationChoice.label}</Text>
                <Pressable onPress={() => setDestinationChoice(null)} accessibilityRole="button" accessibilityLabel="Quitar destino seleccionado">
                  <Text style={styles.linkText}>Quitar</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar parada o lugar..."
                  accessibilityLabel="Buscar destino"
                  value={plannerQuery}
                  onChangeText={setPlannerQuery}
                />
                {plannerResults.map((option) => (
                  <Pressable
                    key={option.id}
                    onPress={() => {
                      setDestinationChoice(option);
                      setPlannerQuery('');
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Seleccionar destino ${option.label}`}>
                    <View style={styles.listItem}>
                      <Text style={styles.listTitle}>{option.label}</Text>
                      <Text style={styles.listMeta}>{option.type === 'stop' ? 'Parada' : 'Lugar'}</Text>
                    </View>
                  </Pressable>
                ))}
              </>
            )}
          </View>

          <Pressable
            style={styles.primaryButton}
            onPress={calculatePlan}
            accessibilityRole="button"
            accessibilityLabel="Calcular ruta hacia el destino seleccionado">
            <Text style={styles.primaryButtonText}>Calcular ruta</Text>
          </Pressable>

          {planError && <Text style={styles.helperText}>{planError}</Text>}

          {planResult && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Resultado</Text>
              <Text style={styles.helperText}>Itinerario orientativo del catálogo. Los tiempos de recorrido no confirman la operación ni las llegadas actuales.</Text>
              <Text style={styles.helperText}>
                {Math.round(planResult.totalDurationSec / 60)} min · {formatDistance(planResult.totalDistanceMeters)}
              </Text>
              {isWeb ? (
                <View style={styles.webPlannerFallback}>
                  <Text style={styles.helperText}>
                    El mapa de la ruta se muestra en móvil; en web te dejamos el itinerario detallado abajo.
                  </Text>
                </View>
              ) : (
                <MapView
                  style={styles.plannerMap}
                  accessibilityLabel="Mapa con la ruta recomendada"
                  initialRegion={{ ...CAGUAS_CENTER, latitudeDelta: 0.07, longitudeDelta: 0.07 }}>
                  {planResult.steps.map((step, index) => (
                    <Polyline
                      key={`step-${index}`}
                      coordinates={[
                        { latitude: step.from.lat, longitude: step.from.lng },
                        { latitude: step.to.lat, longitude: step.to.lng },
                      ]}
                      strokeWidth={4}
                      strokeColor={
                        step.mode === 'walk' ? '#16a34a' : step.mode === 'transfer' ? '#f97316' : '#2563eb'
                      }
                    />
                  ))}
                </MapView>
              )}
              {planResult.steps.map((step, index) => (
                <View key={`step-list-${index}`} style={styles.listItem}>
                  <Text style={styles.listTitle}>
                    {step.mode === 'walk'
                      ? 'Camina'
                      : step.mode === 'transfer'
                        ? 'Transbordo'
                        : `Trolley ruta ${step.routeId ?? 'N/A'}`}
                  </Text>
                  <Text style={styles.listMeta}>
                    {Math.round(step.durationSec / 60)} min · {formatDistance(step.distanceMeters)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      <Modal visible={Boolean(selectedStop || selectedTrolley || selectedRoute)} animationType="slide" onRequestClose={closeModal}>
        <ScrollView contentContainerStyle={styles.modalContent}>
          {selectedStop && (
            <>
              <Text style={styles.modalTitle}>{stopLabel(selectedStop)}</Text>
              <Text style={styles.modalSubtitle}>Ruta {selectedStop.routeId ?? 'N/A'}</Text>
              {selectedRoutes.length > 0 && (
                <Text style={styles.helperText}>
                  {selectedRoutes.map((route) => route.description ?? `Ruta ${route.id}`).join(', ')}
                </Text>
              )}
              <Pressable
                style={styles.secondaryButton}
                onPress={() => toggleStopFavorite(selectedStop.id)}
                disabled={!favoritesLoaded}
                accessibilityRole="button"
                accessibilityLabel={
                  isStopFavorite(selectedStop.id)
                    ? 'Quitar parada de favoritos'
                    : 'Guardar parada en favoritos'
                }>
                <Text style={styles.secondaryButtonText}>
                  {isStopFavorite(selectedStop.id) ? 'Quitar de favoritos' : 'Guardar como favorita'}
                </Text>
              </Pressable>
              {favoritesStorageError && <Text style={styles.helperText}>No se pudo guardar el cambio en este dispositivo.</Text>}
              <Pressable
                style={styles.primaryButton}
                onPress={() => setShowEta((prev) => !prev)}
                accessibilityRole="button"
                accessibilityHint="Abre la tarjeta con tiempos estimados de recorrido hacia esta parada.">
                <Text style={styles.primaryButtonText}>{showEta ? 'Ocultar ETA' : 'Ver ETA'}</Text>
              </Pressable>

              <View style={styles.discoveryNearbySection}>
                <Text style={styles.sectionTitle}>Descubre cerca de esta parada</Text>
                {discoveryNearbyQuery.isLoading ? (
                  <ActivityIndicator style={{ marginTop: 10 }} />
                ) : discoveryNearbyQuery.isError ? (
                  <Pressable accessibilityRole="button" accessibilityLabel="Reintentar lugares cercanos" disabled={discoveryNearbyQuery.isFetching} onPress={() => discoveryNearbyQuery.refetch()}><Text style={styles.linkText}>No pudimos cargar los lugares. Reintentar</Text></Pressable>
                ) : discoveryNearbyQuery.data?.data && discoveryNearbyQuery.data.data.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.discoveryNearbyScroll}>
                    {discoveryNearbyQuery.data.data.map((item) => (
                      <Pressable 
                        key={item.id} 
                        style={styles.discoveryNearbyCard}
                        onPress={() => {
                          if (item.type === 'evento') {
                            router.push({ pathname: '/eventos' as any, params: { q: item.title } });
                          } else {
                            router.push({ pathname: '/gastronomia' as any, params: { q: item.title } });
                          }
                          closeModal();
                        }}>
                        <Text style={styles.discoveryNearbyType}>{item.tag || item.type}</Text>
                        <Text style={styles.discoveryNearbyTitle} numberOfLines={2}>{item.title}</Text>
                        <Text style={styles.discoveryNearbySubtitle}>{item.subtitle}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                ) : (
                  <Text style={styles.helperText}>No se encontraron eventos o lugares cerca ahora mismo.</Text>
                )}
              </View>

              {showEta && (
                <View style={styles.etaBox}>
                  <Text style={styles.etaTitle}>Tiempo estimado de recorrido</Text>
                  <Text style={styles.helperText}>Estimación entre la posición reciente del vehículo y esta parada. No confirma dirección, frecuencia ni hora de llegada del servicio.</Text>
                  {!nearestTrolleyForStop ? (
                    <Text style={styles.helperText}>No hay un trolley con señal reciente en esta ruta para calcular una llegada confiable.</Text>
                  ) : etaQuery.isLoading ? (
                    <ActivityIndicator />
                  ) : etaQuery.isError ? (
                    <><Text style={styles.helperText}>No pudimos cargar el ETA ahora mismo.</Text><Pressable accessibilityRole="button" accessibilityLabel="Reintentar ETA" disabled={etaQuery.isFetching} onPress={() => etaQuery.refetch()}><Text style={styles.linkText}>Reintentar</Text></Pressable></>
                  ) : etaLines.length > 0 ? (
                    etaLines.map((line) => (
                      <View key={`${line.label}-${line.value}`} style={styles.etaRow}>
                        <Text style={styles.etaLabel}>{line.label}</Text>
                        <Text style={styles.etaValue}>{line.value}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.helperText}>No hay datos de ETA disponibles para esta parada.</Text>
                  )}
                </View>
              )}
            </>
          )}
          {selectedRoute && (
            <>
              <Text style={styles.modalTitle}>{selectedRoute.description || `Ruta ${selectedRoute.id}`}</Text>
              <Text style={styles.modalSubtitle}>{selectedRoute.directionStartName || 'Origen'} → {selectedRoute.directionEndName || 'Destino'}</Text>
              {selectedRoute.departureTimes && <Text style={styles.helperText}>Salidas según catálogo: {selectedRoute.departureTimes}</Text>}
              <Text style={styles.helperText}>El trazado y las paradas son del catálogo. La operación actual requiere señales recientes.</Text>
              {stops.filter((stop) => stop.routeId === selectedRoute.id).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((stop) => (
                <Pressable key={`route-detail-${stop.id}`} onPress={() => selectStop(stop)} accessibilityRole="button" accessibilityLabel={`Abrir ${stopLabel(stop)}`} style={styles.listItem}>
                  <Text style={styles.listTitle}>{stopLabel(stop)}</Text>
                </Pressable>
              ))}
              <Pressable style={styles.primaryButton} accessibilityRole="button" accessibilityLabel="Ver trazado de ruta en mapa" onPress={closeModal}><Text style={styles.primaryButtonText}>Ver en mapa</Text></Pressable>
            </>
          )}
          {selectedTrolley && (
            <>
              <Text style={styles.modalTitle}>Trolley {selectedTrolley.assetId ?? 'N/A'}</Text>
              <Text style={styles.modalSubtitle}>Ruta {selectedTrolley.routeId ?? 'N/A'}</Text>
              <Text style={styles.helperText}>Velocidad: {selectedTrolley.speed ?? 'N/A'}</Text>
              <Text style={styles.helperText}>Estado: {selectedTrolley.status ?? 'N/A'}</Text>
              {selectedTrolley.when && (
                <Text style={styles.helperText}>Última actualización: {formatEtaValue(selectedTrolley.when)}</Text>
              )}
            </>
          )}
          <Pressable style={styles.linkButton} onPress={closeModal} accessibilityRole="button" accessibilityLabel="Cerrar detalle">
            <Text style={styles.linkText}>Cerrar</Text>
          </Pressable>
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  statusCard: {
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 16,
    backgroundColor: '#eff6ff',
    padding: 14,
    gap: 14,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  statusEyebrow: {
    color: '#1d4ed8',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  statusTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 2,
  },
  statusMeta: {
    color: '#475569',
    marginTop: 4,
  },
  refreshButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  refreshButtonDisabled: {
    opacity: 0.7,
  },
  refreshButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  statusStatsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statusStat: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#fff',
    padding: 12,
    gap: 4,
  },
  statusStatValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
  },
  statusStatLabel: {
    color: '#475569',
    fontSize: 12,
  },
  quickActionsCard: {
    marginHorizontal: 12,
    marginTop: 4,
    borderRadius: 16,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fdba74',
    padding: 14,
    gap: 10,
  },
  quickActionsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#9a3412',
  },
  quickActionsText: {
    color: '#7c2d12',
    lineHeight: 20,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quickActionButton: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: '#ea580c',
    paddingVertical: 11,
    alignItems: 'center',
  },
  quickActionButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  quickActionGhostButton: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fdba74',
    backgroundColor: '#fff',
    paddingVertical: 11,
    alignItems: 'center',
  },
  quickActionGhostText: {
    color: '#9a3412',
    fontWeight: '700',
  },
  toggleRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  toggleButton: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingVertical: 8,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#e0f2fe',
    borderColor: '#38bdf8',
  },
  toggleText: {
    fontWeight: '600',
  },
  errorBanner: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  errorText: {
    color: '#b91c1c',
    fontWeight: '600',
  },
  errorRetryButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  errorRetryText: {
    color: '#b91c1c',
    fontWeight: '700',
  },
  mapWrap: {
    flex: 1,
  },
  webMapFallback: {
    flex: 1,
    padding: 16,
    gap: 12,
  },
  map: {
    flex: 1,
  },
  dashboardOverlay: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    zIndex: 20,
  },
  nearbyOverlay: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  mapLoadingOverlay: {
    position: 'absolute',
    top: 16,
    right: 16,
    left: 16,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1,
    borderColor: '#dbeafe',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  mapLoadingText: {
    color: '#1d4ed8',
    fontWeight: '600',
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  searchRow: {
    marginBottom: 8,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 10,
  },
  section: {
    gap: 8,
  },
  radiusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  radiusInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    minWidth: 80,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
  },
  listItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  listTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  listMeta: {
    color: '#6b7280',
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#93c5fd',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  secondaryButtonText: {
    color: '#1d4ed8',
    fontWeight: '600',
  },
  helperText: {
    color: '#6b7280',
    fontSize: 13,
  },
  selectedChip: {
    padding: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  linkButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  linkText: {
    color: '#2563eb',
    fontWeight: '600',
  },
  modalContent: {
    flexGrow: 1,
    padding: 20,
    gap: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#6b7280',
  },
  etaBox: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    gap: 10,
  },
  etaTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  etaRow: {
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 4,
  },
  etaLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    color: '#475569',
  },
  etaValue: {
    fontSize: 15,
    color: '#0f172a',
  },
  webPlannerFallback: {
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  plannerMap: {
    height: 220,
    borderRadius: 12,
    marginTop: 8,
  },
  debugOverlay: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 4,
    borderRadius: 4,
  },
  debugText: {
    color: '#fff',
    fontSize: 10,
  },
  discoveryNearbySection: {
    marginTop: 16,
    gap: 8,
  },
  discoveryNearbyScroll: {
    gap: 12,
    paddingRight: 20,
  },
  discoveryNearbyCard: {
    width: 160,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 4,
  },
  discoveryNearbyType: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2563eb',
    textTransform: 'uppercase',
  },
  discoveryNearbyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  discoveryNearbySubtitle: {
    fontSize: 12,
    color: '#64748b',
  },
});

import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';

import { useFavorites } from '@/components/transportFavorites';
import { formatDistance, sortByDistance, type LatLng } from '@/components/transportGeo';
import { useBootstrapQuery, useEtaQuery, usePositionsQuery, useRoutesQuery, useStopsQuery } from '@/components/transportQueries';
import { planRoute, type RoutePlan } from '@/components/transportPlanner';
import type { Marker as ApiMarker, Position, RoutePoint } from '@/components/transportTypes';

type ViewMode = 'mapa' | 'lista' | 'planner';

type LocationChoice = {
  id: string;
  label: string;
  lat: number;
  lng: number;
  type: 'stop' | 'marker';
};

const CAGUAS_CENTER = { latitude: 18.2341, longitude: -66.0485 };

export default function TransportScreen() {
  const bootstrapQuery = useBootstrapQuery();
  const routesQuery = useRoutesQuery();
  const stopsQuery = useStopsQuery();
  const positionsQuery = usePositionsQuery();
  const { favorites, toggleStopFavorite, isStopFavorite } = useFavorites();

  const [viewMode, setViewMode] = useState<ViewMode>('mapa');
  const [searchText, setSearchText] = useState('');
  const [radiusMeters, setRadiusMeters] = useState(600);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'granted' | 'denied'>(
    'idle',
  );
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);

  const [selectedStop, setSelectedStop] = useState<RoutePoint | null>(null);
  const [selectedTrolley, setSelectedTrolley] = useState<Position | null>(null);
  const [showEta, setShowEta] = useState(false);

  const [originChoice, setOriginChoice] = useState<LocationChoice | null>(null);
  const [destinationChoice, setDestinationChoice] = useState<LocationChoice | null>(null);
  const [originQuery, setOriginQuery] = useState('');
  const [plannerQuery, setPlannerQuery] = useState('');
  const [planResult, setPlanResult] = useState<RoutePlan | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);

  const etaLatLngs = selectedStop ? `${selectedStop.lat},${selectedStop.lng}` : null;
  const etaQuery = useEtaQuery(etaLatLngs, undefined, showEta);

  const stops = stopsQuery.data?.stops ?? bootstrapQuery.data?.stops ?? [];
  const routePoints = bootstrapQuery.data?.routePoints ?? [];
  const markers = bootstrapQuery.data?.markers ?? [];
  const routes = routesQuery.data?.routes ?? bootstrapQuery.data?.routes ?? [];
  const positions = positionsQuery.data?.positions ?? bootstrapQuery.data?.positions ?? [];

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

  const activePositions = positions.filter((pos) => pos.lat != null && pos.lng != null);

  const apiError =
    bootstrapQuery.error ||
    stopsQuery.error ||
    routesQuery.error ||
    positionsQuery.error ||
    etaQuery.error;

  const requestLocation = async () => {
    setLocationStatus('loading');
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setLocationStatus('denied');
      return;
    }
    const current = await Location.getCurrentPositionAsync({});
    setUserLocation({ lat: current.coords.latitude, lng: current.coords.longitude });
    setLocationStatus('granted');
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
      .filter((marker) => marker.lat != null && marker.lng != null)
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

  const calculatePlan = () => {
    setPlanError(null);
    if (!userLocation && !originChoice) {
      setPlanError('Necesitas ubicacion u origen seleccionado.');
      return;
    }
    if (!destinationChoice || routePoints.length === 0) {
      setPlanError('Selecciona un destino y espera datos de rutas.');
      return;
    }
    const origin = originChoice ?? (userLocation ? { ...userLocation, id: 'me', label: 'Mi ubicacion', type: 'stop' } : null);
    if (!origin) return;
    const result = planRoute(
      { lat: origin.lat, lng: origin.lng },
      { lat: destinationChoice.lat, lng: destinationChoice.lng },
      routePoints,
    );
    if (!result) {
      setPlanError('No se encontro una ruta con los datos actuales.');
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
    setShowEta(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.toggleRow}>
        <Pressable
          style={[styles.toggleButton, viewMode === 'mapa' && styles.toggleButtonActive]}
          onPress={() => setViewMode('mapa')}>
          <Text style={styles.toggleText}>Mapa</Text>
        </Pressable>
        <Pressable
          style={[styles.toggleButton, viewMode === 'lista' && styles.toggleButtonActive]}
          onPress={() => setViewMode('lista')}>
          <Text style={styles.toggleText}>Lista</Text>
        </Pressable>
        <Pressable
          style={[styles.toggleButton, viewMode === 'planner' && styles.toggleButtonActive]}
          onPress={() => setViewMode('planner')}>
          <Text style={styles.toggleText}>Ruta</Text>
        </Pressable>
      </View>
      {apiError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>No se pudo cargar la data en este momento.</Text>
        </View>
      )}

      {viewMode === 'mapa' && (
        <MapView style={styles.map} initialRegion={{ ...CAGUAS_CENTER, latitudeDelta: 0.07, longitudeDelta: 0.07 }} showsUserLocation>
          {stops.map((stop) => (
            <Marker
              key={`stop-${stop.id}`}
              coordinate={{ latitude: stop.lat, longitude: stop.lng }}
              title={stopLabel(stop)}
              pinColor="#1d4ed8"
              onPress={() => setSelectedStop(stop)}
            />
          ))}
          {activePositions.map((pos) => (
            <Marker
              key={`pos-${pos.assetId ?? `${pos.lat}-${pos.lng}`}`}
              coordinate={{ latitude: pos.lat as number, longitude: pos.lng as number }}
              title={`Trolley ${pos.assetId ?? ''}`}
              pinColor="#dc2626"
              onPress={() => setSelectedTrolley(pos)}
            />
          ))}
        </MapView>
      )}

      {viewMode === 'lista' && (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar paradas..."
              value={searchText}
              onChangeText={setSearchText}
            />
          </View>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cerca de mi</Text>
            <Pressable style={styles.primaryButton} onPress={requestLocation}>
              <Text style={styles.primaryButtonText}>
                {locationStatus === 'loading' ? 'Buscando...' : 'Actualizar ubicacion'}
              </Text>
            </Pressable>
            <View style={styles.radiusRow}>
              <Text style={styles.helperText}>Radio (m):</Text>
              <TextInput
                style={styles.radiusInput}
                value={String(radiusMeters)}
                keyboardType="numeric"
                onChangeText={(value) => {
                  const parsed = Number.parseInt(value, 10);
                  if (!Number.isNaN(parsed)) setRadiusMeters(parsed);
                }}
              />
            </View>
            {userLocation ? (
              nearbyStops.length > 0 ? (
                nearbyStops.map(({ item, distance }) => (
                  <Pressable key={`nearby-${item.id}`} onPress={() => setSelectedStop(item)}>
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
              <Text style={styles.helperText}>Activa ubicacion para ver paradas cercanas.</Text>
            )}
          </View>

          {favorites.stopIds.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Favoritas</Text>
              {favorites.stopIds
                .map((stopId) => stops.find((stop) => stop.id === stopId))
                .filter(Boolean)
                .map((stop) => (
                  <Pressable key={`fav-stop-${stop?.id}`} onPress={() => stop && setSelectedStop(stop)}>
                    <View style={styles.listItem}>
                      <Text style={styles.listTitle}>{stop ? stopLabel(stop) : 'Parada'}</Text>
                    </View>
                  </Pressable>
                ))}
            </View>
          )}
          <Text style={styles.sectionTitle}>Trolleys activos</Text>
          {positionsQuery.isLoading ? (
            <ActivityIndicator />
          ) : (
            activePositions.map((pos) => (
              <Pressable key={`list-pos-${pos.assetId ?? `${pos.lat}-${pos.lng}`}`} onPress={() => setSelectedTrolley(pos)}>
                <View style={styles.listItem}>
                  <Text style={styles.listTitle}>Trolley {pos.assetId ?? 'N/A'}</Text>
                  <Text style={styles.listMeta}>Ruta {pos.routeId ?? 'N/A'}</Text>
                </View>
              </Pressable>
            ))
          )}

          <Text style={styles.sectionTitle}>Paradas</Text>
          {filteredStops.map((stop) => (
            <Pressable key={`list-stop-${stop.id}`} onPress={() => setSelectedStop(stop)}>
              <View style={styles.listItem}>
                <Text style={styles.listTitle}>{stopLabel(stop)}</Text>
                <Text style={styles.listMeta}>Ruta {stop.routeId ?? 'N/A'}</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {viewMode === 'planner' && (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ubicacion</Text>
            <Pressable style={styles.primaryButton} onPress={requestLocation}>
              <Text style={styles.primaryButtonText}>
                {locationStatus === 'loading' ? 'Buscando...' : 'Usar mi ubicacion'}
              </Text>
            </Pressable>
            {userLocation && (
              <Text style={styles.helperText}>
                Ubicacion actual: {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
              </Text>
            )}
            {locationStatus === 'denied' && (
              <Text style={styles.helperText}>Permiso denegado. Habilitalo en Ajustes.</Text>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Origen (opcional)</Text>
            {originChoice ? (
              <View style={styles.selectedChip}>
                <Text>{originChoice.label}</Text>
                <Pressable onPress={() => setOriginChoice(null)}>
                  <Text style={styles.linkText}>Quitar</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <Text style={styles.helperText}>Si no eliges origen, usamos tu ubicacion.</Text>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar origen (parada o lugar)"
                  value={originQuery}
                  onChangeText={setOriginQuery}
                />
                {originResults.map((option) => (
                  <Pressable
                    key={`origin-${option.id}`}
                    onPress={() => {
                      setOriginChoice(option);
                      setOriginQuery('');
                    }}>
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
                <Pressable onPress={() => setDestinationChoice(null)}>
                  <Text style={styles.linkText}>Quitar</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar parada o lugar..."
                  value={plannerQuery}
                  onChangeText={setPlannerQuery}
                />
                {plannerResults.map((option) => (
                  <Pressable
                    key={option.id}
                    onPress={() => {
                      setDestinationChoice(option);
                      setPlannerQuery('');
                    }}>
                    <View style={styles.listItem}>
                      <Text style={styles.listTitle}>{option.label}</Text>
                      <Text style={styles.listMeta}>{option.type === 'stop' ? 'Parada' : 'Lugar'}</Text>
                    </View>
                  </Pressable>
                ))}
              </>
            )}
          </View>

          <Pressable style={styles.primaryButton} onPress={calculatePlan}>
            <Text style={styles.primaryButtonText}>Calcular ruta</Text>
          </Pressable>

          {planError && <Text style={styles.helperText}>{planError}</Text>}

          {planResult && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Resultado</Text>
              <Text style={styles.helperText}>
                {Math.round(planResult.totalDurationSec / 60)} min · {formatDistance(planResult.totalDistanceMeters)}
              </Text>
              <MapView
                style={styles.plannerMap}
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

      <Modal visible={Boolean(selectedStop || selectedTrolley)} animationType="slide" onRequestClose={closeModal}>
        <View style={styles.modalContent}>
          {selectedStop && (
            <>
              <Text style={styles.modalTitle}>{stopLabel(selectedStop)}</Text>
              <Text style={styles.modalSubtitle}>Ruta {selectedStop.routeId ?? 'N/A'}</Text>
              {selectedRoutes.length > 0 && (
                <Text style={styles.helperText}>
                  {selectedRoutes.map((route) => route.description ?? `Ruta ${route.id}`).join(', ')}
                </Text>
              )}
              <Pressable style={styles.secondaryButton} onPress={() => toggleStopFavorite(selectedStop.id)}>
                <Text style={styles.secondaryButtonText}>
                  {isStopFavorite(selectedStop.id) ? 'Quitar de favoritos' : 'Guardar como favorita'}
                </Text>
              </Pressable>
              <Pressable style={styles.primaryButton} onPress={() => setShowEta((prev) => !prev)}>
                <Text style={styles.primaryButtonText}>Ver ETA</Text>
              </Pressable>
              {showEta && (
                <View style={styles.etaBox}>
                  {etaQuery.isLoading ? (
                    <ActivityIndicator />
                  ) : etaQuery.data ? (
                    <Text style={styles.helperText}>{JSON.stringify(etaQuery.data)}</Text>
                  ) : (
                    <Text style={styles.helperText}>No hay datos de ETA.</Text>
                  )}
                </View>
              )}
            </>
          )}
          {selectedTrolley && (
            <>
              <Text style={styles.modalTitle}>Trolley {selectedTrolley.assetId ?? 'N/A'}</Text>
              <Text style={styles.modalSubtitle}>Ruta {selectedTrolley.routeId ?? 'N/A'}</Text>
              <Text style={styles.helperText}>Velocidad: {selectedTrolley.speed ?? 'N/A'}</Text>
              <Text style={styles.helperText}>Estado: {selectedTrolley.status ?? 'N/A'}</Text>
            </>
          )}
          <Pressable style={styles.linkButton} onPress={closeModal}>
            <Text style={styles.linkText}>Cerrar</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
  },
  errorText: {
    color: '#b91c1c',
    fontWeight: '600',
  },
  map: {
    flex: 1,
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
    flex: 1,
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
    padding: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
  },
  plannerMap: {
    height: 220,
    borderRadius: 12,
    marginTop: 8,
  },
});

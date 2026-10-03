import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { positiveId, validCoordinates, validEtaCoordinates } from './transportContracts';
import { isAuthorizationError, retryTransportQuery } from './transportClient';

import {
  fetchBootstrap,
  fetchDiscovery,
  fetchEta,
  fetchEventos,
  fetchGastronomia,
  fetchNearbyStops,
  fetchNearbyVehicles,
  fetchPositions,
  fetchProactiveRecommendations,
  fetchRecommendations,
  fetchRoutes,
  fetchSearch,
  fetchStops,
  fetchTracking,
} from './transportApi';
import { useTransportSettings } from './transportSettings';
import type { RecommendationsFilters, TrackingFilters, DiscoveryFilters } from './transportTypes';

const FIVE_MINUTES = 5 * 60 * 1000;
const THIRTY_MINUTES = 30 * 60 * 1000;

function usePollingActive() {
  const focused = useIsFocused();
  const [active, setActive] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    return () => subscription.remove();
  }, []);
  return focused && active;
}

export function useBootstrapQuery() {
  const { apiBaseUrl, ready } = useTransportSettings();
  return useQuery({
    queryKey: ['bootstrap', apiBaseUrl],
    queryFn: () => fetchBootstrap(undefined, apiBaseUrl ?? undefined),
    staleTime: FIVE_MINUTES,
    enabled: ready,
    retry: retryTransportQuery,
  });
}

export function useRoutesQuery() {
  const { apiBaseUrl, ready } = useTransportSettings();
  return useQuery({
    queryKey: ['routes', apiBaseUrl],
    queryFn: () => fetchRoutes(apiBaseUrl ?? undefined),
    staleTime: THIRTY_MINUTES,
    enabled: ready,
    retry: retryTransportQuery,
  });
}

export function useStopsQuery() {
  const { apiBaseUrl, ready } = useTransportSettings();
  return useQuery({
    queryKey: ['stops', apiBaseUrl],
    queryFn: () => fetchStops(apiBaseUrl ?? undefined),
    staleTime: THIRTY_MINUTES,
    enabled: ready,
    retry: retryTransportQuery,
  });
}

export function usePositionsQuery() {
  const { apiBaseUrl, positionRefreshMs, ready } = useTransportSettings();
  const pollingActive = usePollingActive();
  return useQuery({
    queryKey: ['positions', apiBaseUrl],
    queryFn: () => fetchPositions(undefined, apiBaseUrl ?? undefined),
    enabled: ready && pollingActive,
    refetchInterval: (query) => pollingActive && !isAuthorizationError(query.state.error) ? positionRefreshMs : false,
    refetchIntervalInBackground: false,
    retry: retryTransportQuery,
  });
}

export function useTrackingQuery(filters?: TrackingFilters) {
  const { apiBaseUrl, positionRefreshMs, ready } = useTransportSettings();
  const pollingActive = usePollingActive();
  return useQuery({
    queryKey: ['tracking', apiBaseUrl, filters],
    queryFn: () => fetchTracking(filters, apiBaseUrl ?? undefined),
    enabled: ready && pollingActive,
    refetchInterval: (query) => pollingActive && !isAuthorizationError(query.state.error) ? positionRefreshMs : false,
    refetchIntervalInBackground: false,
    retry: retryTransportQuery,
  });
}

export function useEtaQuery(
  options: { latlngs?: string | null; assetId?: number | null; stopId?: number | null; time?: number },
  enabled = true
) {
  const { apiBaseUrl, ready } = useTransportSettings();
  const hasParams = Boolean(validEtaCoordinates(options.latlngs) || (positiveId(options.assetId) && positiveId(options.stopId)));

  return useQuery({
    queryKey: ['eta', options.latlngs, options.assetId, options.stopId, options.time, apiBaseUrl],
    queryFn: () =>
      fetchEta(
        {
          latlngs: options.latlngs ?? undefined,
          assetId: options.assetId ?? undefined,
          stopId: options.stopId ?? undefined,
          time: options.time,
        },
        apiBaseUrl ?? undefined
      ),
    enabled: ready && hasParams && enabled,
    retry: retryTransportQuery,
    staleTime: 30000, // 30 segundos
  });
}

export function useGastronomiaQuery(filters?: { q?: string; category?: string | string[]; limit?: number }) {
  const { apiBaseUrl, ready } = useTransportSettings();
  return useQuery({
    queryKey: ['gastronomia', apiBaseUrl, filters],
    queryFn: () => fetchGastronomia(apiBaseUrl ?? undefined, filters),
    enabled: ready,
    retry: retryTransportQuery,
    staleTime: THIRTY_MINUTES,
  });
}

export function useEventosQuery(filters?: { q?: string; category?: string | string[]; from?: string; to?: string; limit?: number }, enabled = true) {
  const { apiBaseUrl, ready } = useTransportSettings();
  return useQuery({
    queryKey: ['eventos', apiBaseUrl, filters],
    queryFn: () => fetchEventos(apiBaseUrl ?? undefined, filters),
    enabled: ready && enabled,
    retry: retryTransportQuery,
    staleTime: FIVE_MINUTES,
  });
}

export function useDiscoveryQuery(filters?: DiscoveryFilters, enabled = true) {
  const { apiBaseUrl, ready } = useTransportSettings();
  return useQuery({
    queryKey: ['discovery', apiBaseUrl, filters],
    queryFn: () => fetchDiscovery(apiBaseUrl ?? undefined, filters),
    retry: retryTransportQuery,
    enabled: ready && enabled,
    staleTime: FIVE_MINUTES,
  });
}

export function useRecommendationsQuery(filters?: RecommendationsFilters) {
  const { apiBaseUrl, ready } = useTransportSettings();
  return useQuery({
    queryKey: ['recommendations', apiBaseUrl, filters],
    queryFn: () => fetchRecommendations(apiBaseUrl ?? undefined, filters),
    staleTime: FIVE_MINUTES,
    retry: retryTransportQuery,
    enabled: ready,
  });
}

export function useNearbyStopsQuery(
  lat?: number,
  lng?: number,
  filters?: { limit?: number; maxDistanceMeters?: number },
  enabled = true
) {
  const { apiBaseUrl, ready } = useTransportSettings();
  const hasCoords = validCoordinates(lat, lng);

  return useQuery({
    queryKey: ['stops-nearby', apiBaseUrl, lat, lng, filters],
    queryFn: () => fetchNearbyStops(lat!, lng!, filters, apiBaseUrl ?? undefined),
    enabled: ready && hasCoords && enabled,
    retry: retryTransportQuery,
    staleTime: THIRTY_MINUTES,
  });
}

export function useNearbyVehiclesQuery(
  lat?: number,
  lng?: number,
  filters?: { limit?: number },
  enabled = true
) {
  const { apiBaseUrl, positionRefreshMs, ready } = useTransportSettings();
  const pollingActive = usePollingActive();
  const hasCoords = validCoordinates(lat, lng);

  return useQuery({
    queryKey: ['vehicles-nearby', apiBaseUrl, lat, lng, filters],
    queryFn: () => fetchNearbyVehicles(lat!, lng!, filters, apiBaseUrl ?? undefined),
    enabled: ready && pollingActive && hasCoords && enabled,
    refetchInterval: (query) => pollingActive && !isAuthorizationError(query.state.error) ? positionRefreshMs : false,
    refetchIntervalInBackground: false,
    retry: retryTransportQuery,
  });
}

export function useSearchQuery(q: string, filters?: { limit?: number; lat?: number; lng?: number }) {
  const { apiBaseUrl, ready } = useTransportSettings();
  const isValidQuery = q.trim().length >= 2;

  return useQuery({
    queryKey: ['search', apiBaseUrl, q, filters],
    queryFn: () => fetchSearch(q, filters, apiBaseUrl ?? undefined),
    enabled: ready && (isValidQuery || validCoordinates(filters?.lat, filters?.lng)),
    retry: retryTransportQuery,
    staleTime: FIVE_MINUTES,
  });
}

export function useProactiveRecommendationsQuery(filters?: { limit?: number; lat?: number; lng?: number }) {
  const { apiBaseUrl, ready } = useTransportSettings();
  return useQuery({
    queryKey: ['proactive-recommendations', apiBaseUrl, filters],
    queryFn: () => fetchProactiveRecommendations(filters, apiBaseUrl ?? undefined),
    staleTime: FIVE_MINUTES,
    retry: retryTransportQuery,
    enabled: ready,
  });
}

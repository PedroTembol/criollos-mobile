import { useQuery } from '@tanstack/react-query';

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

export function useBootstrapQuery() {
  const { apiBaseUrl } = useTransportSettings();
  return useQuery({
    queryKey: ['bootstrap', apiBaseUrl],
    queryFn: () => fetchBootstrap(undefined, apiBaseUrl ?? undefined),
    staleTime: FIVE_MINUTES,
  });
}

export function useRoutesQuery() {
  const { apiBaseUrl } = useTransportSettings();
  return useQuery({
    queryKey: ['routes', apiBaseUrl],
    queryFn: () => fetchRoutes(apiBaseUrl ?? undefined),
    staleTime: THIRTY_MINUTES,
  });
}

export function useStopsQuery() {
  const { apiBaseUrl } = useTransportSettings();
  return useQuery({
    queryKey: ['stops', apiBaseUrl],
    queryFn: () => fetchStops(apiBaseUrl ?? undefined),
    staleTime: THIRTY_MINUTES,
  });
}

export function usePositionsQuery() {
  const { apiBaseUrl, positionRefreshMs } = useTransportSettings();
  return useQuery({
    queryKey: ['positions', apiBaseUrl],
    queryFn: () => fetchPositions(undefined, apiBaseUrl ?? undefined),
    refetchInterval: positionRefreshMs,
    refetchIntervalInBackground: true,
  });
}

export function useTrackingQuery(filters?: TrackingFilters) {
  const { apiBaseUrl, positionRefreshMs } = useTransportSettings();
  return useQuery({
    queryKey: ['tracking', apiBaseUrl, filters],
    queryFn: () => fetchTracking(filters, apiBaseUrl ?? undefined),
    refetchInterval: positionRefreshMs,
    refetchIntervalInBackground: true,
  });
}

export function useEtaQuery(
  options: { latlngs?: string | null; assetId?: number | null; stopId?: number | null; time?: number },
  enabled = true
) {
  const { apiBaseUrl } = useTransportSettings();
  const hasParams = Boolean(options.latlngs || (options.assetId && options.stopId));

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
    enabled: hasParams && enabled,
    staleTime: 30000, // 30 segundos
  });
}

export function useGastronomiaQuery(filters?: { q?: string; category?: string | string[]; limit?: number }) {
  const { apiBaseUrl } = useTransportSettings();
  return useQuery({
    queryKey: ['gastronomia', apiBaseUrl, filters],
    queryFn: () => fetchGastronomia(apiBaseUrl ?? undefined, filters),
    staleTime: THIRTY_MINUTES,
  });
}

export function useEventosQuery(filters?: { q?: string; category?: string | string[]; from?: string; to?: string; limit?: number }) {
  const { apiBaseUrl } = useTransportSettings();
  return useQuery({
    queryKey: ['eventos', apiBaseUrl, filters],
    queryFn: () => fetchEventos(apiBaseUrl ?? undefined, filters),
    staleTime: FIVE_MINUTES,
  });
}

export function useDiscoveryQuery(filters?: DiscoveryFilters) {
  const { apiBaseUrl } = useTransportSettings();
  return useQuery({
    queryKey: ['discovery', apiBaseUrl, filters],
    queryFn: () => fetchDiscovery(apiBaseUrl ?? undefined, filters),
    staleTime: FIVE_MINUTES,
  });
}

export function useRecommendationsQuery(filters?: RecommendationsFilters) {
  const { apiBaseUrl } = useTransportSettings();
  return useQuery({
    queryKey: ['recommendations', apiBaseUrl, filters],
    queryFn: () => fetchRecommendations(apiBaseUrl ?? undefined, filters),
    staleTime: FIVE_MINUTES,
    retry: 1,
  });
}

export function useNearbyStopsQuery(
  lat?: number,
  lng?: number,
  filters?: { limit?: number; maxDistanceMeters?: number },
  enabled = true
) {
  const { apiBaseUrl } = useTransportSettings();
  const hasCoords = lat !== undefined && lng !== undefined;

  return useQuery({
    queryKey: ['stops-nearby', apiBaseUrl, lat, lng, filters],
    queryFn: () => fetchNearbyStops(lat!, lng!, filters, apiBaseUrl ?? undefined),
    enabled: hasCoords && enabled,
    staleTime: THIRTY_MINUTES,
  });
}

export function useNearbyVehiclesQuery(
  lat?: number,
  lng?: number,
  filters?: { limit?: number },
  enabled = true
) {
  const { apiBaseUrl, positionRefreshMs } = useTransportSettings();
  const hasCoords = lat !== undefined && lng !== undefined;

  return useQuery({
    queryKey: ['vehicles-nearby', apiBaseUrl, lat, lng, filters],
    queryFn: () => fetchNearbyVehicles(lat!, lng!, filters, apiBaseUrl ?? undefined),
    enabled: hasCoords && enabled,
    refetchInterval: positionRefreshMs,
  });
}

export function useSearchQuery(q: string, filters?: { limit?: number; lat?: number; lng?: number }) {
  const { apiBaseUrl } = useTransportSettings();
  const isValidQuery = q.trim().length >= 2;

  return useQuery({
    queryKey: ['search', apiBaseUrl, q, filters],
    queryFn: () => fetchSearch(q, filters, apiBaseUrl ?? undefined),
    enabled: isValidQuery || (filters?.lat !== undefined && filters?.lng !== undefined),
    staleTime: FIVE_MINUTES,
  });
}

export function useProactiveRecommendationsQuery(filters?: { limit?: number; lat?: number; lng?: number }) {
  const { apiBaseUrl } = useTransportSettings();
  return useQuery({
    queryKey: ['proactive-recommendations', apiBaseUrl, filters],
    queryFn: () => fetchProactiveRecommendations(filters, apiBaseUrl ?? undefined),
    staleTime: FIVE_MINUTES,
    retry: 1,
  });
}


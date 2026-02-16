import { useQuery } from '@tanstack/react-query';

import { fetchBootstrap, fetchEta, fetchPositions, fetchRoutes, fetchStops } from './transportApi';
import { useTransportSettings } from './transportSettings';

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

export function useEtaQuery(latlngs: string | null, time?: number, enabled = true) {
  const { apiBaseUrl } = useTransportSettings();
  return useQuery({
    queryKey: ['eta', latlngs, time, apiBaseUrl],
    queryFn: () => fetchEta(latlngs ?? '', time, apiBaseUrl ?? undefined),
    enabled: Boolean(latlngs) && enabled,
  });
}

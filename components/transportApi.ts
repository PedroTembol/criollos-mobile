import AsyncStorage from '@react-native-async-storage/async-storage';
import { createTransportClient } from './transportClient';
import { DEFAULT_API_BASE_URL, positiveId, validEtaCoordinates } from './transportContracts';

import type {
  BootstrapResponse,
  CriolloRecommendation,
  DiscoveryResponse,
  EtaResponse,
  EventosResponse,
  FeedbackRequest,
  FeedbackResponse,
  GastronomiaResponse,
  NearbyStopsResponse,
  NearbyVehiclesResponse,
  PositionsResponse,
  RecommendationsFeed,
  RecommendationsFilters,
  DiscoveryFilters,
  RoutesResponse,
  SearchResponse,
  StopsResponse,
  TrackingSnapshot,
  TrackingFilters,
} from './transportTypes';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL;
const API_KEY = process.env.EXPO_PUBLIC_API_KEY;
const { request, persistentRequest } = createTransportClient({
  baseUrl: API_BASE_URL,
  apiKey: API_KEY,
  storage: AsyncStorage,
});

export function fetchBootstrap(idMarker?: number, baseUrl?: string) {
  return persistentRequest<BootstrapResponse>('/bootstrap', {
    query: idMarker ? { idMarker } : undefined,
    baseUrl,
  });
}

export function fetchPositions(idMarker?: number, baseUrl?: string) {
  return request<PositionsResponse>('/vehicles/positions', {
    query: idMarker ? { idMarker } : undefined,
    baseUrl,
  });
}

export function fetchRoutes(baseUrl?: string) {
  return persistentRequest<RoutesResponse>('/routes', { baseUrl });
}

export function fetchStops(baseUrl?: string) {
  return persistentRequest<StopsResponse>('/stops', { baseUrl });
}

export function fetchTracking(filters?: TrackingFilters, baseUrl?: string) {
  return request<TrackingSnapshot>('/tracking', {
    query: filters as Record<string, string | number | undefined>,
    baseUrl,
  });
}

export function fetchEta(
  options: { latlngs?: string; assetId?: number; stopId?: number; time?: number },
  baseUrl?: string
) {
  const latlngs = validEtaCoordinates(options.latlngs) ? options.latlngs : undefined;
  if (!latlngs && !(positiveId(options.assetId) && positiveId(options.stopId))) {
    return Promise.reject(new Error('Se necesita un vehículo y una parada válidos para calcular la llegada.'));
  }
  return request<EtaResponse>('/eta', {
    query: {
      latlngs,
      assetId: options.assetId,
      stopId: options.stopId,
      time: options.time,
    },
    baseUrl,
  });
}

export function sendFeedback(payload: FeedbackRequest, baseUrl?: string) {
  return request<FeedbackResponse>('/feedback', {
    method: 'POST',
    body: payload,
    baseUrl,
  });
}

export function fetchGastronomia(baseUrl?: string, filters?: { q?: string; category?: string | string[]; limit?: number }) {
  const query = {
    q: filters?.q,
    category: Array.isArray(filters?.category) ? filters?.category.join(',') : filters?.category,
    limit: filters?.limit,
  };

  // Solo cachear si no hay filtros de búsqueda (feed general/por categoría)
  if (!filters?.q) {
    return persistentRequest<GastronomiaResponse>('/gastronomia', {
      baseUrl,
      query,
    });
  }

  return request<GastronomiaResponse>('/gastronomia', {
    baseUrl,
    query,
  });
}

export function fetchEventos(baseUrl?: string, filters?: { q?: string; category?: string | string[]; from?: string; to?: string; limit?: number }) {
  const query = {
    q: filters?.q,
    category: Array.isArray(filters?.category) ? filters?.category.join(',') : filters?.category,
    from: filters?.from,
    to: filters?.to,
    limit: filters?.limit,
  };

  // Solo cachear si no hay filtros de búsqueda o fechas específicas (agenda general)
  if (!filters?.q && !filters?.from && !filters?.to) {
    return persistentRequest<EventosResponse>('/eventos', {
      baseUrl,
      query,
    });
  }

  return request<EventosResponse>('/eventos', {
    baseUrl,
    query,
  });
}

export function fetchDiscovery(baseUrl?: string, filters?: DiscoveryFilters) {
  const query = {
    q: filters?.q,
    type: Array.isArray(filters?.type) ? filters?.type.join(',') : filters?.type,
    category: Array.isArray(filters?.category) ? filters?.category.join(',') : filters?.category,
    from: filters?.from,
    to: filters?.to,
    limit: filters?.limit,
    lat: filters?.lat,
    lng: filters?.lng,
    radiusMeters: filters?.radiusMeters,
  };

  // Solo cachear si no hay filtros de búsqueda o proximidad (feed general)
  if (!filters?.q && filters?.lat === undefined && filters?.lng === undefined) {
    return persistentRequest<DiscoveryResponse>('/discovery', {
      baseUrl,
      query,
    });
  }

  return request<DiscoveryResponse>('/discovery', {
    baseUrl,
    query,
  });
}

export function fetchRecommendations(
  baseUrl?: string,
  filters?: RecommendationsFilters
) {
  const query = {
    type: Array.isArray(filters?.type)
      ? filters?.type.join(',')
      : filters?.type,
    limit: filters?.limit,
  };

  // Cachear recomendaciones generales
  if (!filters?.type) {
    return persistentRequest<RecommendationsFeed>('/recommendations', {
      baseUrl,
      query,
    });
  }

  return request<RecommendationsFeed>('/recommendations', {
    baseUrl,
    query,
  });
}

export function fetchNearbyStops(
  lat: number,
  lng: number,
  filters?: { limit?: number; maxDistanceMeters?: number },
  baseUrl?: string
) {
  return request<NearbyStopsResponse>('/stops/nearby', {
    query: {
      lat,
      lng,
      limit: filters?.limit,
      maxDistanceMeters: filters?.maxDistanceMeters,
    },
    baseUrl,
  });
}

export function fetchNearbyVehicles(
  lat: number,
  lng: number,
  filters?: { limit?: number },
  baseUrl?: string
) {
  return request<NearbyVehiclesResponse>('/vehicles/nearby', {
    query: {
      lat,
      lng,
      limit: filters?.limit,
    },
    baseUrl,
  });
}

export function fetchSearch(
  q: string,
  filters?: { limit?: number; lat?: number; lng?: number },
  baseUrl?: string
) {
  return request<SearchResponse>('/search', {
    query: {
      q,
      limit: filters?.limit,
      lat: filters?.lat,
      lng: filters?.lng,
    },
    baseUrl,
  });
}

export function fetchProactiveRecommendations(
  filters?: { limit?: number; lat?: number; lng?: number },
  baseUrl?: string
) {
  return request<RecommendationsFeed>('/proactive-recommendations', {
    query: {
      limit: filters?.limit,
      lat: filters?.lat,
      lng: filters?.lng,
    },
    baseUrl,
  });
}

export function getApiBaseUrl() {
  return API_BASE_URL;
}

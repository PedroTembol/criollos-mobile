import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

const DEFAULT_BASE_URL =
  Platform.OS === 'android' ? 'http://10.0.2.2:3000/api/v1' : 'https://criollos.app/api/v1';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? DEFAULT_BASE_URL;
const API_KEY = process.env.EXPO_PUBLIC_API_KEY;

type RequestOptions = {
  method?: 'GET' | 'POST';
  query?: Record<string, string | number | undefined>;
  body?: unknown;
};

function buildUrl(path: string, query?: RequestOptions['query'], baseUrl?: string) {
  const url = new URL(path, baseUrl ?? API_BASE_URL);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      url.searchParams.set(key, String(value));
    });
  }
  return url.toString();
}

async function request<T>(path: string, options: RequestOptions & { baseUrl?: string } = {}) {
  const url = buildUrl(path, options.query, options.baseUrl);
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  // Ngrok requiere este header para evitar la página de advertencia
  if (url.includes('ngrok-free.app') || url.includes('ngrok.io')) {
    headers['ngrok-skip-browser-warning'] = 'true';
  }

  if (API_KEY) {
    headers['x-api-key'] = API_KEY;
  }
  if (options.body) headers['Content-Type'] = 'application/json';

  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    if (response.status === 401 || response.status === 403) {
      const errorMsg = API_KEY
        ? `API error ${response.status}: ${text || 'Invalid API key'}`
        : `API error ${response.status}: ${text || 'Missing API key'}`;
      throw new Error(errorMsg);
    }
    throw new Error(`API error ${response.status}: ${text}`);
  }

  return (await response.json()) as T;
}

/**
 * Intenta obtener datos de la red y guarda una copia en AsyncStorage.
 * Si la red falla, intenta recuperar la última copia exitosa del cache local.
 */
async function persistentRequest<T>(
  cacheKey: string,
  path: string,
  options: RequestOptions & { baseUrl?: string } = {}
): Promise<T> {
  const fullCacheKey = `criollos.cache.${cacheKey}`;

  try {
    const data = await request<T>(path, options);
    // Guardar en cache asincrónicamente
    AsyncStorage.setItem(fullCacheKey, JSON.stringify(data)).catch(() => {
      /* ignore storage errors */
    });
    return data;
  } catch (error) {
    console.warn(`Red fallida para ${path}, intentando cache local...`, error);
    const cached = await AsyncStorage.getItem(fullCacheKey).catch(() => null);
    if (cached) {
      try {
        return JSON.parse(cached) as T;
      } catch (parseError) {
        console.error(`Error al parsear cache para ${cacheKey}`, parseError);
      }
    }
    // Si no hay cache o falla, re-lanzar el error original de red
    throw error;
  }
}

export function fetchBootstrap(idMarker?: number, baseUrl?: string) {
  return persistentRequest<BootstrapResponse>('bootstrap', '/bootstrap', {
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
  return persistentRequest<RoutesResponse>('routes', '/routes', { baseUrl });
}

export function fetchStops(baseUrl?: string) {
  return persistentRequest<StopsResponse>('stops', '/stops', { baseUrl });
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
  return request<EtaResponse>('/eta', {
    query: {
      latlngs: options.latlngs,
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
    const cacheKey = `gastronomia.${filters?.category || 'all'}`;
    return persistentRequest<GastronomiaResponse>(cacheKey, '/gastronomia', {
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
    const cacheKey = `eventos.${filters?.category || 'all'}`;
    return persistentRequest<EventosResponse>(cacheKey, '/eventos', {
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
  if (!filters?.q && !filters?.lat && !filters?.lng) {
    const cacheKey = `discovery.${filters?.type || 'all'}.${filters?.category || 'all'}`;
    return persistentRequest<DiscoveryResponse>(cacheKey, '/discovery', {
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
    return persistentRequest<RecommendationsFeed>('recommendations', '/recommendations', {
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

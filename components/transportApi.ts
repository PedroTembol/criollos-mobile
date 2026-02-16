import { Platform } from 'react-native';

import type {
  BootstrapResponse,
  EtaResponse,
  FeedbackRequest,
  FeedbackResponse,
  PositionsResponse,
  RoutesResponse,
  StopsResponse,
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

export function fetchBootstrap(idMarker?: number, baseUrl?: string) {
  return request<BootstrapResponse>('/bootstrap', {
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
  return request<RoutesResponse>('/routes', { baseUrl });
}

export function fetchStops(baseUrl?: string) {
  return request<StopsResponse>('/stops', { baseUrl });
}

export function fetchEta(latlngs: string, time?: number, baseUrl?: string) {
  return request<EtaResponse>('/eta', {
    query: { latlngs, time },
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

export function getApiBaseUrl() {
  return API_BASE_URL;
}

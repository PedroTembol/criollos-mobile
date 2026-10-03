import { apiCacheKey, buildApiUrl, normalizeRoutePoints } from './transportContracts';
import type { ClientCacheMetadata } from './transportTypes';

export type ApiRequestOptions = {
  method?: 'GET' | 'POST';
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  baseUrl?: string;
};

type Storage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<unknown>;
};

export class TransportApiError extends Error {
  constructor(message: string, public status?: number) { super(message); }
}

export function isAuthorizationError(error: unknown) {
  return error instanceof TransportApiError && [401, 403].includes(error.status ?? 0);
}

export function retryTransportQuery(failureCount: number, error: unknown) {
  return !isAuthorizationError(error) && failureCount < 1;
}

function normalizePayload(path: string, data: unknown) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new TransportApiError('Respuesta de API inválida.');
  const payload = data as Record<string, unknown>;
  if (payload.status === 'error' || payload.ok === false || (path === '/eta' && (payload.error || Number(payload.total_seconds) < 0))) {
    throw new TransportApiError('El servicio no pudo completar la consulta.');
  }
  const arrayFields: Record<string, string[]> = {
    '/bootstrap': ['routes', 'stops', 'routePoints', 'markers', 'positions'],
    '/routes': ['routes'], '/stops': ['stops'], '/vehicles/positions': ['positions'],
    '/tracking': ['vehicles'], '/eventos': ['data'], '/gastronomia': ['data'], '/discovery': ['data'],
    '/recommendations': ['data'], '/proactive-recommendations': ['data'], '/search': ['results'],
    '/stops/nearby': ['data'], '/vehicles/nearby': ['data'],
  };
  for (const field of arrayFields[path] ?? []) {
    if (!Array.isArray(payload[field])) throw new TransportApiError('La API devolvió un formato inesperado.');
  }
  if (path === '/bootstrap' || path === '/stops') {
    return {
      ...payload,
      stops: normalizeRoutePoints(payload.stops as any[]),
      ...(path === '/bootstrap' ? { routePoints: normalizeRoutePoints(payload.routePoints as any[]) } : {}),
    };
  }
  return payload;
}

export function createTransportClient(options: {
  baseUrl: string;
  apiKey?: string;
  storage: Storage;
  fetch?: typeof fetch;
  now?: () => number;
  timeoutMs?: number;
}) {
  const fetcher = options.fetch ?? fetch;
  const now = options.now ?? Date.now;

  async function request<T>(path: string, requestOptions: ApiRequestOptions = {}): Promise<T> {
    const url = buildApiUrl(path, requestOptions.baseUrl ?? options.baseUrl, requestOptions.query);
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (new URL(url).hostname.endsWith('.ngrok-free.app') || new URL(url).hostname.endsWith('.ngrok.io')) headers['ngrok-skip-browser-warning'] = 'true';
    if (options.apiKey) headers['x-api-key'] = options.apiKey;
    if (requestOptions.body !== undefined) headers['Content-Type'] = 'application/json';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 15_000);
    try {
      const response = await fetcher(url, {
        method: requestOptions.method ?? 'GET', headers, signal: controller.signal,
        body: requestOptions.body !== undefined ? JSON.stringify(requestOptions.body) : undefined,
      });
      if (!response.ok) {
        throw new TransportApiError(response.status === 401 || response.status === 403
          ? 'Este servicio requiere acceso autorizado. Revisa la configuración de API.'
          : `El servicio no está disponible (HTTP ${response.status}).`, response.status);
      }
      if (!response.headers.get('content-type')?.toLowerCase().includes('application/json')) {
        throw new TransportApiError('El servidor devolvió una página en lugar de datos. Revisa la URL de API.');
      }
      return normalizePayload(path, await response.json()) as T;
    } catch (error) {
      if (controller.signal.aborted) throw new TransportApiError('La consulta tardó demasiado. Inténtalo de nuevo.');
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function persistentRequest<T>(path: string, requestOptions: ApiRequestOptions = {}): Promise<T> {
    const key = apiCacheKey(buildApiUrl(path, requestOptions.baseUrl ?? options.baseUrl, requestOptions.query));
    try {
      const data = await request<Record<string, unknown>>(path, requestOptions);
      const cachedAt = new Date(now()).toISOString();
      await options.storage.setItem(key, JSON.stringify({ cachedAt, data })).catch(() => undefined);
      return { ...data, clientCache: { source: 'network', cachedAt, ageMs: 0 } satisfies ClientCacheMetadata } as T;
    } catch (error) {
      // Authorization changes must not silently fall back to an earlier privileged response.
      if (isAuthorizationError(error)) throw error;
      const raw = await options.storage.getItem(key).catch(() => null);
      if (raw) {
        try {
          const { data, cachedAt } = JSON.parse(raw);
          const ageMs = now() - Date.parse(cachedAt);
          // Static transport can survive a week offline; editorial feeds expire after a day.
          const maxAgeMs = ['/bootstrap', '/routes', '/stops'].includes(path) ? 7 * 86_400_000 : 86_400_000;
          if (Number.isFinite(ageMs) && ageMs >= 0 && ageMs <= maxAgeMs) {
            return {
              ...normalizePayload(path, data),
              clientCache: { source: 'local-cache', cachedAt, ageMs, networkError: 'No se pudo actualizar desde la red.' } satisfies ClientCacheMetadata,
            } as T;
          }
        } catch { /* Ignore corrupted or expired cache; retain the original request failure. */ }
      }
      throw error;
    }
  }
  return { request, persistentRequest };
}

import type { Position, RoutePoint, SearchResult } from './transportTypes';
import type { LatLng } from './transportGeo';

export const DEFAULT_API_BASE_URL = 'https://criollos.app/api/v1';

export function normalizeApiBaseUrl(value: string): string {
  const url = new URL(value.trim());
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('Usa una URL http o https sin credenciales, consulta ni fragmento.');
  }
  return url.toString().replace(/\/+$/, '');
}

export function buildApiUrl(
  path: string,
  baseUrl = DEFAULT_API_BASE_URL,
  query?: Record<string, string | number | undefined>,
) {
  // Relative paths retain the API prefix; a leading slash otherwise replaces it.
  const relativePath = path.replace(/^\/+/, '');
  if (!relativePath || relativePath.includes('://') || relativePath.split('/').includes('..')) {
    throw new Error('Ruta de API inválida.');
  }
  const url = new URL(relativePath, `${normalizeApiBaseUrl(baseUrl)}/`);
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  });
  url.searchParams.sort();
  return url.toString();
}

export function apiCacheKey(url: string) {
  return `criollos.cache.v2.${encodeURIComponent(url)}`;
}

export function validCoordinates(lat: unknown, lng: unknown): lat is number {
  return typeof lat === 'number' && typeof lng === 'number' &&
    Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

/** Route points arrive in microdegrees. Also accept degrees for compatible servers. */
export function normalizeCoordinates(lat: unknown, lng: unknown): LatLng | null {
  if (validCoordinates(lat, lng)) return { lat: lat as number, lng: lng as number };
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isInteger(lat) || !Number.isInteger(lng)) return null;
  const degrees = { lat: lat / 1_000_000, lng: lng / 1_000_000 };
  return validCoordinates(degrees.lat, degrees.lng) ? degrees : null;
}

export function normalizeRoutePoints(points: RoutePoint[] = []): RoutePoint[] {
  return points.flatMap((point) => {
    const coordinates = normalizeCoordinates(point.lat, point.lng);
    return coordinates ? [{ ...point, ...coordinates }] : [];
  });
}

export function positiveId(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function resolveStop(result: Pick<SearchResult, 'id' | 'metadata'>, stops: RoutePoint[]): RoutePoint | null {
  const routePointId = positiveId(result.metadata?.routePointId);
  if (routePointId !== null) return stops.find((stop) => stop.id === routePointId) ?? null;
  // Search's stopId and stop-/s-nearby- IDs refer to a marker, not a route point.
  const prefixedId = result.id.match(/^(?:stop-|s-nearby-)(\d+)$/)?.[1];
  const markerId = positiveId(result.metadata?.markerId ?? result.metadata?.stopId ?? prefixedId);
  if (markerId !== null) {
    return stops.find((stop) => stop.markerId === markerId) ?? stops.find((stop) => stop.id === markerId) ?? null;
  }
  const id = positiveId(result.id);
  return id === null ? null : stops.find((stop) => stop.id === id) ?? stops.find((stop) => stop.markerId === id) ?? null;
}

export function resolveRouteId(result: Pick<SearchResult, 'id' | 'metadata'>): number | null {
  return positiveId(result.metadata?.routeId ?? result.id.match(/^route-(\d+)$/)?.[1] ?? result.id);
}

export function etaCoordinates(vehicle: Pick<Position, 'lat' | 'lng'> | null, stop: RoutePoint | null): string | undefined {
  if (!vehicle || !stop || !validCoordinates(vehicle.lat, vehicle.lng) || !validCoordinates(stop.lat, stop.lng)) return undefined;
  return `${vehicle.lat},${vehicle.lng}|${stop.lat},${stop.lng}`;
}

export function validEtaCoordinates(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const pairs = value.split('|');
  return pairs.length === 2 && pairs.every((pair) => {
    const parts = pair.split(',');
    return parts.length === 2 && parts.every((part) => part.trim() !== '') && validCoordinates(Number(parts[0]), Number(parts[1]));
  });
}

export function positionFreshness(position: Pick<Position, 'when'>, now = Date.now()): 'live' | 'stale' | 'unknown' {
  const reportedAt = Date.parse(position.when ?? '');
  if (!Number.isFinite(reportedAt) || reportedAt > now + 60_000) return 'unknown';
  return now - reportedAt <= 120_000 ? 'live' : 'stale';
}

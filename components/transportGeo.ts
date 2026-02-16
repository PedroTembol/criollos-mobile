export type LatLng = {
  lat: number;
  lng: number;
};

const EARTH_RADIUS_M = 6371_000;

export function haversineMeters(a: LatLng, b: LatLng) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);

  const h =
    sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function formatDistance(meters: number) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function sortByDistance<T>(
  items: T[],
  getLatLng: (item: T) => LatLng | null,
  origin: LatLng,
) {
  return items
    .map((item) => {
      const point = getLatLng(item);
      if (!point) return null;
      return { item, distance: haversineMeters(origin, point) };
    })
    .filter((entry): entry is { item: T; distance: number } => Boolean(entry))
    .sort((a, b) => a.distance - b.distance);
}

export type ContentActionTarget = { pathname: '/' | '/eventos' | '/gastronomia' | '/descubrir'; params?: Record<string, string> };

export function safeExternalUrl(value?: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.toString() : null;
  } catch { return null; }
}

export function contentActionTarget(value: string): ContentActionTarget | null {
  try {
    const url = new URL(value, 'https://criollos.app');
    if (url.origin !== 'https://criollos.app' || url.username || url.password) return null;
    const paths: Record<string, ContentActionTarget['pathname']> = {
      '/': '/', '/cerca': '/', '/transporte': '/', '/eventos': '/eventos', '/gastronomia': '/gastronomia',
      '/discovery': '/descubrir', '/descubrir': '/descubrir',
    };
    const pathname = paths[url.pathname];
    if (!pathname) return null;
    const params = Object.fromEntries(url.searchParams.entries());
    // Legacy assistant actions put the transport query after #map rather than ?.
    // Preserve recognised selection fields; an explicit URL query takes precedence.
    if (pathname === '/' && /^#map\?/.test(url.hash)) {
      const fragmentParams = new URLSearchParams(url.hash.slice('#map?'.length));
      for (const key of ['routeId', 'stopId', 'routePointId', 'assetId', 'lat', 'lng', 'q']) {
        if (!(key in params) && fragmentParams.has(key)) params[key] = fragmentParams.get(key)!;
      }
    }
    return { pathname, params };
  } catch { return null; }
}

export function contentMapTarget(item: { title: string; location?: string | null; lat?: number | null; lng?: number | null }): ContentActionTarget {
  if (typeof item.lat === 'number' && typeof item.lng === 'number' && Number.isFinite(item.lat) && Number.isFinite(item.lng) &&
      Math.abs(item.lat) <= 90 && Math.abs(item.lng) <= 180) {
    return { pathname: '/', params: { lat: String(item.lat), lng: String(item.lng) } };
  }
  return { pathname: '/', params: { q: item.location || item.title } };
}

/** Guard asynchronous actions and rapid repeat navigation, including failed actions. */
export function createContentActionRunner(now: () => number = Date.now, cooldownMs = 650) {
  let busy = false;
  let lastStarted = -Infinity;
  return async (action: () => unknown | Promise<unknown>): Promise<boolean> => {
    if (busy || now() - lastStarted < cooldownMs) return false;
    busy = true;
    lastStarted = now();
    try { await action(); return true; } finally { busy = false; }
  };
}

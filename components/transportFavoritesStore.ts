import { positiveId, validCoordinates } from './transportContracts';

export type FavoritePlace = { id: string; label: string; lat: number; lng: number };
export type FavoritesState = { stopIds: number[]; places: FavoritePlace[] };
type Snapshot = { loaded: boolean; favorites: FavoritesState; storageError: boolean };
type Storage = { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<unknown> };

export function parseFavorites(raw: string | null): FavoritesState {
  let parsed: Partial<FavoritesState> = {};
  try { parsed = raw ? JSON.parse(raw) ?? {} : {}; } catch { /* Start with an empty valid state. */ }
  return {
    stopIds: [...new Set((Array.isArray(parsed.stopIds) ? parsed.stopIds : []).filter((id) => positiveId(id) === id))],
    places: (Array.isArray(parsed.places) ? parsed.places : []).filter((place) => place && typeof place.id === 'string' && typeof place.label === 'string' && validCoordinates(place.lat, place.lng)),
  };
}

/** One shared store per server keeps tabs synchronized and serializes quick taps. */
export function createFavoritesStore(storage: Storage, key: string, legacyKey?: string) {
  let snapshot: Snapshot = { loaded: false, favorites: { stopIds: [], places: [] }, storageError: false };
  const listeners = new Set<() => void>();
  let loading: Promise<void> | undefined;
  let saves = Promise.resolve();
  const notify = () => listeners.forEach((listener) => listener());
  function update(change: (state: FavoritesState) => FavoritesState) {
    if (!snapshot.loaded) return;
    const next = change(snapshot.favorites);
    snapshot = { ...snapshot, favorites: next };
    notify();
    saves = saves.then(async () => {
      try { await storage.setItem(key, JSON.stringify(next)); }
      catch { snapshot = { ...snapshot, storageError: true }; notify(); }
    });
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    load() {
      loading ??= (async () => {
        try {
          const raw = await storage.getItem(key) ?? (legacyKey ? await storage.getItem(legacyKey) : null);
          snapshot = { loaded: true, favorites: parseFavorites(raw), storageError: false };
        } catch { snapshot = { ...snapshot, loaded: true, storageError: true }; }
        notify();
      })();
      return loading;
    },
    toggleStop(stopId: number) {
      if (positiveId(stopId) !== stopId) return;
      update((state) => ({ ...state, stopIds: state.stopIds.includes(stopId) ? state.stopIds.filter((id) => id !== stopId) : [...state.stopIds, stopId] }));
    },
    addPlace(place: FavoritePlace) {
      if (!validCoordinates(place.lat, place.lng) || !place.id || !place.label) return;
      update((state) => ({ ...state, places: [...state.places.filter((item) => item.id !== place.id), place] }));
    },
    removePlace(placeId: string) { update((state) => ({ ...state, places: state.places.filter((place) => place.id !== placeId) })); },
    flush: () => saves,
  };
}

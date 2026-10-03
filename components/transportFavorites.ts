import { useEffect, useMemo, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_API_BASE_URL } from './transportContracts';
import { useTransportSettings } from './transportSettings';
import { createFavoritesStore } from './transportFavoritesStore';
export type { FavoritePlace } from './transportFavoritesStore';

const stores = new Map<string, ReturnType<typeof createFavoritesStore>>();

export function useFavorites() {
  const { apiBaseUrl } = useTransportSettings();
  const baseUrl = apiBaseUrl ?? process.env.EXPO_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL;
  const store = useMemo(() => {
    let value = stores.get(baseUrl);
    if (!value) {
      value = createFavoritesStore(AsyncStorage, `criollos.transport.favorites.v2.${encodeURIComponent(baseUrl)}`,
        baseUrl === DEFAULT_API_BASE_URL ? 'criollos.transport.favorites' : undefined);
      stores.set(baseUrl, value);
    }
    return value;
  }, [baseUrl]);
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  useEffect(() => { void store.load(); }, [store]);
  return {
    ...snapshot,
    isStopFavorite: (stopId: number) => snapshot.favorites.stopIds.includes(stopId),
    toggleStopFavorite: store.toggleStop,
    addPlace: store.addPlace,
    removePlace: store.removePlace,
  };
}

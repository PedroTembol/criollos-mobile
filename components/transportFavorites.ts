import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type FavoritePlace = {
  id: string;
  label: string;
  lat: number;
  lng: number;
};

type FavoritesState = {
  stopIds: number[];
  places: FavoritePlace[];
};

const STORAGE_KEY = 'criollos.transport.favorites';

const DEFAULT_STATE: FavoritesState = {
  stopIds: [],
  places: [],
};

export function useFavorites() {
  const [state, setState] = useState<FavoritesState>(DEFAULT_STATE);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let isActive = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => (raw ? (JSON.parse(raw) as FavoritesState) : DEFAULT_STATE))
      .then((next) => {
        if (!isActive) return;
        setState(next ?? DEFAULT_STATE);
        setLoaded(true);
      })
      .catch(() => {
        setLoaded(true);
      });
    return () => {
      isActive = false;
    };
  }, []);

  const persist = useCallback((next: FavoritesState) => {
    setState(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {
      // ignore save errors
    });
  }, []);

  const toggleStopFavorite = useCallback(
    (stopId: number) => {
      const exists = state.stopIds.includes(stopId);
      const next = {
        ...state,
        stopIds: exists
          ? state.stopIds.filter((id) => id !== stopId)
          : [...state.stopIds, stopId],
      };
      persist(next);
    },
    [persist, state],
  );

  const addPlace = useCallback(
    (place: FavoritePlace) => {
      const next = {
        ...state,
        places: [...state.places.filter((item) => item.id !== place.id), place],
      };
      persist(next);
    },
    [persist, state],
  );

  const removePlace = useCallback(
    (placeId: string) => {
      const next = {
        ...state,
        places: state.places.filter((item) => item.id !== placeId),
      };
      persist(next);
    },
    [persist, state],
  );

  const isStopFavorite = useCallback(
    (stopId: number) => state.stopIds.includes(stopId),
    [state.stopIds],
  );

  return useMemo(
    () => ({
      loaded,
      favorites: state,
      isStopFavorite,
      toggleStopFavorite,
      addPlace,
      removePlace,
    }),
    [addPlace, isStopFavorite, loaded, removePlace, state, toggleStopFavorite],
  );
}

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type TransportSettings = {
  lowDataMode: boolean;
  apiBaseUrl: string | null;
  positionRefreshMs: number;
  setLowDataMode: (value: boolean) => void;
  setApiBaseUrl: (value: string) => void;
};

const STORAGE_KEY = 'criollos.transport.settings';
const DEFAULT_REFRESH_MS = 8000;
const LOW_DATA_REFRESH_MS = 30000;

const TransportSettingsContext = createContext<TransportSettings | undefined>(undefined);

type StoredSettings = {
  lowDataMode?: boolean;
  apiBaseUrl?: string | null;
};

export function TransportSettingsProvider({ children }: { children: React.ReactNode }) {
  const [lowDataMode, setLowDataModeState] = useState(false);
  const [apiBaseUrl, setApiBaseUrlState] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => (raw ? (JSON.parse(raw) as StoredSettings) : null))
      .then((stored) => {
        if (!stored || !isActive) return;
        if (typeof stored.lowDataMode === 'boolean') setLowDataModeState(stored.lowDataMode);
        if (typeof stored.apiBaseUrl === 'string') setApiBaseUrlState(stored.apiBaseUrl);
      })
      .catch(() => {
        // ignore load errors
      });

    return () => {
      isActive = false;
    };
  }, []);

  const persist = useCallback((next: StoredSettings) => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {
      // ignore save errors
    });
  }, []);

  const setLowDataMode = useCallback(
    (value: boolean) => {
      setLowDataModeState(value);
      persist({ lowDataMode: value, apiBaseUrl });
    },
    [apiBaseUrl, persist],
  );

  const setApiBaseUrl = useCallback(
    (value: string) => {
      const nextValue = value.trim();
      setApiBaseUrlState(nextValue.length > 0 ? nextValue : null);
      persist({ lowDataMode, apiBaseUrl: nextValue.length > 0 ? nextValue : null });
    },
    [lowDataMode, persist],
  );

  const value = useMemo<TransportSettings>(() => {
    return {
      lowDataMode,
      apiBaseUrl,
      positionRefreshMs: lowDataMode ? LOW_DATA_REFRESH_MS : DEFAULT_REFRESH_MS,
      setLowDataMode,
      setApiBaseUrl,
    };
  }, [apiBaseUrl, lowDataMode, setApiBaseUrl, setLowDataMode]);

  return <TransportSettingsContext.Provider value={value}>{children}</TransportSettingsContext.Provider>;
}

export function useTransportSettings() {
  const context = useContext(TransportSettingsContext);
  if (!context) {
    throw new Error('useTransportSettings must be used within TransportSettingsProvider');
  }
  return context;
}

import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useSearchQuery } from './transportQueries';
import type { SearchResult } from './transportTypes';
import { FeedEmptyState } from './FeedStatus';
import { createContentActionRunner } from './contentActions';

interface SearchOverlayProps {
  onResultPress: (result: SearchResult) => void;
  onClose?: () => void;
  initialQuery?: string;
}

export const SearchOverlay = ({ onResultPress, onClose, initialQuery = '' }: SearchOverlayProps) => {
  const [q, setQ] = useState(initialQuery);
  const [queryText, setQueryText] = useState(q);
  const selection = useRef(createContentActionRunner());
  useEffect(() => setQ(initialQuery), [initialQuery]);
  useEffect(() => { const timer = setTimeout(() => setQueryText(q.trim()), 250); return () => clearTimeout(timer); }, [q]);
  const searchQuery = useSearchQuery(queryText, { limit: 10 });

  const results = searchQuery.data?.results ?? [];

  const getIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'route': return 'bus';
      case 'stop': return 'map-marker';
      case 'evento': return 'calendar';
      case 'gastronomia': return 'cutlery';
      default: return 'search';
    }
  };

  const getTypeLabel = (type: SearchResult['type']) => {
    switch (type) {
      case 'route': return 'Ruta';
      case 'stop': return 'Parada';
      case 'evento': return 'Evento';
      case 'gastronomia': return 'Lugar';
      default: return 'Resultado';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <FontAwesome name="search" size={18} color="#94a3b8" style={styles.searchIcon} />
        <TextInput
          style={styles.input}
          placeholder="Buscar rutas, paradas, eventos..."
          placeholderTextColor="#94a3b8"
          value={q}
          autoFocus={Platform.OS !== 'web'}
          accessibilityLabel="Buscador global de Criollos"
          accessibilityHint="Encuentra transporte, cultura o gastronomía en un solo lugar"
          returnKeyType="search"
          onChangeText={setQ}
        />
        {q.length > 0 && (
          <Pressable onPress={() => setQ('')} accessibilityRole="button" accessibilityLabel="Limpiar búsqueda">
            <FontAwesome name="times-circle" size={18} color="#94a3b8" />
          </Pressable>
        )}
        {onClose && <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Cerrar búsqueda" style={{ marginLeft: 12 }}>
          <FontAwesome name="times" size={18} color="#64748b" />
        </Pressable>}
      </View>

      {q.trim().length >= 2 ? (
        <ScrollView style={styles.resultsList} keyboardShouldPersistTaps="handled">
          {searchQuery.isLoading || queryText !== q.trim() ? (
            <View style={styles.center}>
              <ActivityIndicator color="#2563eb" />
              <Text style={styles.metaText}>Buscando en Caguas...</Text>
            </View>
          ) : searchQuery.isError ? (
            <FeedEmptyState isLoading={false} isError isFetching={searchQuery.isFetching} onRetry={() => searchQuery.refetch()}
              title="" message="" />
          ) : results.length > 0 ? (
            results.map((result, idx) => (
              <Pressable
                key={`${result.type}-${result.id}-${idx}`}
                style={styles.resultItem}
                onPress={() => { void selection.current(() => onResultPress(result)); }}
                accessibilityRole="button"
                accessibilityLabel={`${getTypeLabel(result.type)}: ${result.title}`}>
                <View style={styles.resultIconBox}>
                  <FontAwesome name={getIcon(result.type)} size={16} color="#3b82f6" />
                </View>
                <View style={styles.resultContent}>
                  <Text style={styles.resultTitle} numberOfLines={1}>{result.title}</Text>
                  <Text style={styles.resultSubtitle} numberOfLines={1}>
                    {getTypeLabel(result.type)} {result.subtitle ? `· ${result.subtitle}` : ''}
                  </Text>
                </View>
                <FontAwesome name="chevron-right" size={12} color="#cbd5e1" />
              </Pressable>
            ))
          ) : (
            <View style={styles.center}>
              <Text style={styles.metaText}>No encontramos resultados para "{q}"</Text>
            </View>
          )}
        </ScrollView>
      ) : q.length > 0 ? (
        <View style={styles.center}>
          <Text style={styles.metaText}>Escribe al menos 2 letras...</Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  searchIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#0f172a',
    padding: 0,
  },
  resultsList: {
    maxHeight: 300,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  resultIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  resultContent: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  resultSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  center: {
    padding: 32,
    alignItems: 'center',
    gap: 12,
  },
  metaText: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
  },
});

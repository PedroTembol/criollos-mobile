import { useCallback, useMemo } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { FeedEmptyState, FeedStatus } from '@/components/FeedStatus';
import { useContentFilters } from '@/components/useContentFilters';
import { useContentActions } from '@/components/useContentActions';
import type { GastronomiaPlace } from '@/components/transportTypes';

import { DiscoverySearch } from '@/components/DiscoverySearch';
import { GastronomiaSummaryPanel } from '@/components/GastronomiaSummaryPanel';
import { useGastronomiaQuery } from '@/components/transportQueries';

export default function GastronomiaScreen() {
  const actions = useContentActions();
  const { filters, queryFilters, setFilters, clearFilters } = useContentFilters({ includeDates: false });
  const gastronomiaQuery = useGastronomiaQuery(queryFilters);

  const handleSearch = useCallback((nextFilters: { q?: string; categories?: string[] }) => {
    setFilters({
      q: nextFilters.q,
      category: nextFilters.categories,
    });
  }, []);

  const handleSelectCategory = useCallback((category: string) => {
    setFilters(prev => ({
      ...prev,
      category: [category]
    }));
  }, []);

  const availableCategories = useMemo(
    () => gastronomiaQuery.data?.summary?.categories ?? [],
    [gastronomiaQuery.data?.summary?.categories],
  );

  const handleShare = (item: GastronomiaPlace) => actions.share({ title: item.title, location: item.category, description: item.summary, sourceUrl: item.sourceUrl });
  const handleViewInMap = (item: GastronomiaPlace) => actions.map({ title: item.title });
  const handleSelectPlace = (placeId: string) => {
    const place = gastronomiaQuery.data?.summary?.featuredPlaces?.find(item => item.id === placeId);
    if (place) setFilters({ q: place.title });
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={gastronomiaQuery.data?.data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        onRefresh={() => { if (!gastronomiaQuery.isFetching) void gastronomiaQuery.refetch(); }}
        refreshing={gastronomiaQuery.isFetching && !gastronomiaQuery.isLoading}
        ListHeaderComponent={
          <View style={styles.headerWrap}>
            <View style={styles.heroCard}>
              <Text style={styles.heroEyebrow}>¿Dónde comer?</Text>
              <Text style={styles.heroTitle}>Sabor del Valle del Turabo</Text>
              <Text style={styles.heroText}>
                Desde criollo hasta internacional. Explora los mejores restaurantes y chinchorros de Caguas en un solo lugar.
              </Text>
            </View>
            <FeedStatus data={gastronomiaQuery.data} dataUpdatedAt={gastronomiaQuery.dataUpdatedAt} isError={gastronomiaQuery.isError} isFetching={gastronomiaQuery.isFetching} onRetry={() => gastronomiaQuery.refetch()} />
            <GastronomiaSummaryPanel
              summary={gastronomiaQuery.data?.summary}
              onSelectCategory={handleSelectCategory}
              onSelectRoute={route => setFilters({ category: route.categories })}
              onSelectPlace={handleSelectPlace}
            />
            <DiscoverySearch value={{ q: filters.q, types: filters.type, categories: filters.category }}
              onClear={clearFilters}
              onSearch={handleSearch}
              availableCategories={availableCategories}
              hideTypes
            />
          </View>
        }
        ListEmptyComponent={<FeedEmptyState isLoading={gastronomiaQuery.isLoading} isError={gastronomiaQuery.isError || Boolean(gastronomiaQuery.data?.clientCache?.networkError || gastronomiaQuery.data?.stale || gastronomiaQuery.data?.metadata?.stale || gastronomiaQuery.data?.metadata?.complete === false)} isFetching={gastronomiaQuery.isFetching}
          onRetry={() => gastronomiaQuery.refetch()} onClear={clearFilters} title="No encontramos lugares con esos filtros."
          message="Prueba otro texto o limpia los filtros para volver al contenido completo." />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Pressable
              onPress={() => actions.open(item.sourceUrl)}
              disabled={!item.sourceUrl}
              accessibilityRole={item.sourceUrl ? 'link' : 'text'}
              accessibilityLabel={`${item.title}, categoría ${item.category}`}>
              {item.imageUrl && (
                <Image
                  source={{ uri: item.imageUrl }}
                  style={styles.cardImage}
                  resizeMode="cover"
                  accessibilityIgnoresInvertColors
                  accessibilityLabel={item.imageAlt || item.title}
                />
              )}
              <View style={styles.cardContent}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTag}>{item.category}</Text>
                </View>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardDescription} numberOfLines={3}>
                  {item.summary}
                </Text>
              </View>
            </Pressable>

            <View style={styles.cardActions}>
              <Pressable
                onPress={() => handleViewInMap(item)}
                style={styles.actionButton}
                accessibilityRole="button"
                accessibilityLabel="Buscar ubicación en el mapa de transporte">
                <Ionicons name="map-outline" size={18} color="#ea580c" />
                <Text style={[styles.actionButtonText, { color: '#ea580c' }]}>Buscar lugar</Text>
              </Pressable>

              <Pressable
                onPress={() => handleShare(item)}
                style={styles.actionButton}
                accessibilityRole="button"
                accessibilityLabel="Compartir este lugar">
                <Ionicons name="share-outline" size={18} color="#475569" />
                <Text style={styles.actionButtonText}>Compartir</Text>
              </Pressable>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  listContent: {
    paddingBottom: 24,
  },
  headerWrap: {
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  heroCard: {
    margin: 16,
    marginBottom: 8,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 18,
    padding: 18,
    gap: 6,
  },
  heroEyebrow: {
    color: '#ea580c',
    textTransform: 'uppercase',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  heroTitle: {
    color: '#7c2d12',
    fontSize: 22,
    fontWeight: '800',
  },
  heroText: {
    color: '#9a3412',
    lineHeight: 20,
    opacity: 0.8,
  },
  loadingIndicator: {
    marginTop: 24,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 36,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
  },
  emptyText: {
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
  linkButton: {
    marginTop: 4,
  },
  linkText: {
    color: '#2563eb',
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 2,
  },
  cardImage: {
    width: '100%',
    height: 180,
    backgroundColor: '#f1f5f9',
  },
  cardContent: {
    padding: 16,
    paddingBottom: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    gap: 12,
  },
  cardTag: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ea580c',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    marginBottom: 8,
  },
  cardActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    padding: 12,
    gap: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
});

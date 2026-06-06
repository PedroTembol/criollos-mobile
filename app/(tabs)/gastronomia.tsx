import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { DiscoverySearch } from '@/components/DiscoverySearch';
import { GastronomiaSummaryPanel } from '@/components/GastronomiaSummaryPanel';
import { useGastronomiaQuery } from '@/components/transportQueries';

export default function GastronomiaScreen() {
  const router = useRouter();
  const [filters, setFilters] = useState<{ q?: string; category?: string[] }>({});
  const gastronomiaQuery = useGastronomiaQuery(filters);

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

  const handleShare = useCallback((item: any) => {
    const message = `${item.title}\n${item.category}\n\n${item.summary}\n\nVer más en: ${item.sourceUrl}`;
    Share.share({
      message,
      url: item.sourceUrl || undefined,
      title: item.title,
    });
  }, []);

  const handleViewInMap = useCallback((item: any) => {
    if (item.lat && item.lng) {
      router.push({
        pathname: '/',
        params: { lat: item.lat, lng: item.lng }
      });
    } else {
      router.push({
        pathname: '/',
        params: { q: item.title }
      });
    }
  }, [router]);

  return (
    <View style={styles.container}>
      <FlatList
        data={gastronomiaQuery.data?.data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        onRefresh={gastronomiaQuery.refetch}
        refreshing={gastronomiaQuery.isFetching}
        ListHeaderComponent={
          <View style={styles.headerWrap}>
            <View style={styles.heroCard}>
              <Text style={styles.heroEyebrow}>¿Dónde comer?</Text>
              <Text style={styles.heroTitle}>Sabor del Valle del Turabo</Text>
              <Text style={styles.heroText}>
                Desde criollo hasta internacional. Explora los mejores restaurantes y chinchorros de Caguas en un solo lugar.
              </Text>
            </View>
            <GastronomiaSummaryPanel 
              summary={gastronomiaQuery.data?.summary} 
              onSelectCategory={handleSelectCategory} 
            />
            <DiscoverySearch 
              onSearch={handleSearch} 
              availableCategories={availableCategories}
              hideTypes
            />
          </View>
        }
        ListEmptyComponent={
          gastronomiaQuery.isLoading ? (
            <ActivityIndicator style={styles.loadingIndicator} />
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No encontramos lugares con esos filtros.</Text>
              <Text style={styles.emptyText}>Prueba otro sabor o limpia la búsqueda para volver a la guía completa.</Text>
              <Pressable
                style={styles.linkButton}
                onPress={() => setFilters({})}
                accessibilityRole="button"
                accessibilityLabel="Limpiar filtros de gastronomía">
                <Text style={styles.linkText}>Limpiar filtros</Text>
              </Pressable>
            </View>
          )
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Pressable
              onPress={() => item.sourceUrl && Linking.openURL(item.sourceUrl)}
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
                accessibilityLabel="Ver ubicación en el mapa de transporte">
                <Ionicons name="map-outline" size={18} color="#ea580c" />
                <Text style={[styles.actionButtonText, { color: '#ea580c' }]}>Mapa</Text>
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

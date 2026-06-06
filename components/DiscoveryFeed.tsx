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
import { DiscoverySummaryPanel } from '@/components/DiscoverySummaryPanel';
import { useDiscoveryQuery } from '@/components/transportQueries';

export function DiscoveryFeed() {
  const router = useRouter();
  const [filters, setFilters] = useState<{ q?: string; type?: string[]; category?: string[] }>({});
  const discoveryQuery = useDiscoveryQuery(filters);

  const handleDiscoverySearch = useCallback((nextFilters: { q?: string; types?: string[]; categories?: string[] }) => {
    setFilters({
      q: nextFilters.q,
      type: nextFilters.types,
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
    () => discoveryQuery.data?.summary?.categories ?? ['Cultura', 'Música', 'Gastronomía', 'Deportes', 'Niños', 'Teatro'],
    [discoveryQuery.data?.summary?.categories],
  );

  const handleShare = useCallback((item: any) => {
    const message = `${item.title}\n${item.subtitle}\n\n${item.description}\n\nVer más en: ${item.link}`;
    Share.share({
      message,
      url: item.link || undefined,
      title: item.title,
    });
  }, []);

  const handleAddToCalendar = useCallback((item: any) => {
    if (!item.eventDate) return;

    const startDate = new Date(item.eventDate);
    const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000); // +2 hours default
    
    const format = (date: Date) => date.toISOString().replace(/-|:|\.\d+/g, '');
    const dates = `${format(startDate)}/${format(endDate)}`;

    const url = new URL('https://calendar.google.com/calendar/render');
    url.searchParams.set('action', 'TEMPLATE');
    url.searchParams.set('text', item.title);
    url.searchParams.set('dates', dates);
    url.searchParams.set('details', `${item.description}\n\nFuente: ${item.link}`);
    url.searchParams.set('location', item.subtitle);

    Linking.openURL(url.toString());
  }, []);

  const handleViewInMap = useCallback((item: any) => {
    // Si el API ya devolvió coordenadas enriquecidas (futura mejora del scraper/resolver)
    if (item.lat && item.lng) {
      router.push({
        pathname: '/',
        params: { lat: item.lat, lng: item.lng }
      });
    } else {
      // Si no hay coordenadas, buscamos por nombre del lugar (subtitle o title)
      router.push({
        pathname: '/',
        params: { q: item.subtitle || item.title }
      });
    }
  }, [router]);

  return (
    <FlatList
      data={discoveryQuery.data?.data ?? []}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      onRefresh={discoveryQuery.refetch}
      refreshing={discoveryQuery.isFetching}
      ListHeaderComponent={
        <View style={styles.headerWrap}>
          <View style={styles.heroCard}>
            <Text style={styles.heroEyebrow}>Agenda criolla</Text>
            <Text style={styles.heroTitle}>Descubre qué hacer hoy en Caguas</Text>
            <Text style={styles.heroText}>
              Eventos, experiencias y recomendaciones locales en una pestaña propia, sin mezclarse con la navegación de transporte.
            </Text>
          </View>
          <DiscoverySummaryPanel 
            summary={discoveryQuery.data?.summary} 
            onSelectCategory={handleSelectCategory} 
          />
          <DiscoverySearch onSearch={handleDiscoverySearch} availableCategories={availableCategories} />
        </View>
      }
      ListEmptyComponent={
        discoveryQuery.isLoading ? (
          <ActivityIndicator style={styles.loadingIndicator} />
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No encontramos planes con esos filtros.</Text>
            <Text style={styles.emptyText}>Prueba otro texto o limpia la búsqueda para volver al feed completo.</Text>
            <Pressable
              style={styles.linkButton}
              onPress={() => setFilters({})}
              accessibilityRole="button"
              accessibilityLabel="Limpiar filtros de descubrimiento">
              <Text style={styles.linkText}>Limpiar filtros</Text>
            </Pressable>
          </View>
        )
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Pressable
            onPress={() => item.link && Linking.openURL(item.link)}
            disabled={!item.link}
            accessibilityRole={item.link ? 'link' : 'text'}
            accessibilityState={{ disabled: !item.link }}
            accessibilityLabel={`${item.title}, ${item.subtitle}${item.date ? `, fecha ${item.date}` : ''}${item.tag || item.category ? `, categoría ${item.tag || item.category}` : ''}`}>
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
                <Text style={styles.cardTag}>{item.tag || item.category}</Text>
                {item.date && <Text style={styles.cardDate}>{item.date}</Text>}
              </View>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
              <Text style={styles.cardDescription} numberOfLines={3}>
                {item.description}
              </Text>
            </View>
          </Pressable>

          <View style={styles.cardActions}>
            <Pressable 
              onPress={() => handleViewInMap(item)}
              style={styles.actionButton}
              accessibilityRole="button"
              accessibilityLabel="Ver ubicación en el mapa de transporte">
              <Ionicons name="map-outline" size={18} color="#1d4ed8" />
              <Text style={[styles.actionButtonText, { color: '#1d4ed8' }]}>Mapa</Text>
            </Pressable>

            <Pressable 
              onPress={() => handleShare(item)}
              style={styles.actionButton}
              accessibilityRole="button"
              accessibilityLabel="Compartir este plan">
              <Ionicons name="share-outline" size={18} color="#475569" />
              <Text style={styles.actionButtonText}>Compartir</Text>
            </Pressable>

            {item.type === 'evento' && item.eventDate && (
              <Pressable 
                onPress={() => handleAddToCalendar(item)}
                style={styles.actionButton}
                accessibilityRole="button"
                accessibilityLabel="Añadir a mi calendario">
                <Ionicons name="calendar-outline" size={18} color="#475569" />
                <Text style={styles.actionButtonText}>Calendario</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 18,
    padding: 18,
    gap: 6,
  },
  heroEyebrow: {
    color: '#1d4ed8',
    textTransform: 'uppercase',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  heroTitle: {
    color: '#0f172a',
    fontSize: 22,
    fontWeight: '800',
  },
  heroText: {
    color: '#475569',
    lineHeight: 20,
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
    color: '#1d4ed8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
  },
  cardDate: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
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

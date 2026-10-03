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
import type { Evento } from '@/components/transportTypes';
import { buildEventCalendarUrl } from '@/components/contentCalendar';

import { DiscoverySearch, type DiscoverySearchFilters } from '@/components/DiscoverySearch';
import { EventosSummaryPanel } from '@/components/EventosSummaryPanel';
import { useEventosQuery } from '@/components/transportQueries';

export default function EventosScreen() {
  const actions = useContentActions();
  const { filters, queryFilters, setFilters, clearFilters, clearDateFilters, dateError, hasValidDates } = useContentFilters();
  const eventosQuery = useEventosQuery(queryFilters, hasValidDates);

  const handleSearch = useCallback((nextFilters: DiscoverySearchFilters) => {
    setFilters({
      q: nextFilters.q,
      category: nextFilters.categories,
      from: nextFilters.from,
      to: nextFilters.to,
    });
  }, []);

  const handleSelectCategory = useCallback((category: string) => {
    setFilters(prev => ({
      ...prev,
      category: [category]
    }));
  }, []);

  const availableCategories = useMemo(
    () => eventosQuery.data?.summary?.categories ?? [],
    [eventosQuery.data?.summary?.categories],
  );

  const handleShare = (item: Evento) => actions.share({ title: item.title, location: item.venue, description: item.summary, sourceUrl: item.sourceUrl });
  const calendarUrl = (item: Evento) => buildEventCalendarUrl({ title: item.title, date: item.publishedAt, description: item.summary, location: item.venue, sourceUrl: item.sourceUrl });
  const handleAddToCalendar = (item: Evento) => actions.open(calendarUrl(item));
  const handleViewInMap = (item: Evento) => actions.map({ title: item.title, location: item.venue });

  return (
    <View style={styles.container}>
      <FlatList
        data={hasValidDates ? eventosQuery.data?.data ?? [] : []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        onRefresh={() => { if (hasValidDates && !eventosQuery.isFetching) void eventosQuery.refetch(); }}
        refreshing={eventosQuery.isFetching && !eventosQuery.isLoading}
        ListHeaderComponent={
          <View style={styles.headerWrap}>
            <View style={styles.heroCard}>
              <Text style={styles.heroEyebrow}>Agenda Cultural</Text>
              <Text style={styles.heroTitle}>Eventos en el Valle del Turabo</Text>
              <Text style={styles.heroText}>
                La cartelera oficial de Caguas, desde festivales hasta talleres. Planifica tu semana con el corazón criollo.
              </Text>
            </View>
            <FeedStatus data={hasValidDates ? eventosQuery.data : undefined} dataUpdatedAt={eventosQuery.dataUpdatedAt} isError={eventosQuery.isError} isFetching={eventosQuery.isFetching} onRetry={() => eventosQuery.refetch()} />
            <EventosSummaryPanel
              summary={hasValidDates ? eventosQuery.data?.summary : undefined}
              onSelectCategory={handleSelectCategory}
              onSelectPlan={plan => setFilters(prev => ({ ...prev, q: plan.primaryEventTitle }))}
            />
            <DiscoverySearch value={{ q: filters.q, types: filters.type, categories: filters.category, from: filters.from, to: filters.to }} dateError={dateError}
              onClear={clearFilters} onClearDates={clearDateFilters}
              onSearch={handleSearch}
              availableCategories={availableCategories}
              hideTypes
            />
          </View>
        }
        ListEmptyComponent={dateError ? <Text style={styles.emptyText}>Limpia las fechas del enlace para consultar la agenda.</Text> : <FeedEmptyState isLoading={eventosQuery.isLoading || !hasValidDates} isError={eventosQuery.isError || Boolean(eventosQuery.data?.clientCache?.networkError || eventosQuery.data?.stale || eventosQuery.data?.metadata?.stale || eventosQuery.data?.metadata?.complete === false)} isFetching={eventosQuery.isFetching}
          onRetry={() => eventosQuery.refetch()} onClear={clearFilters} title="No hay eventos con esos filtros."
          message="Prueba otro texto o limpia los filtros para volver al contenido completo." />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Pressable
              onPress={() => actions.open(item.sourceUrl)}
              disabled={!item.sourceUrl}
              accessibilityRole={item.sourceUrl ? 'link' : 'text'}
              accessibilityLabel={`${item.title}, en ${item.venue || 'Caguas'}${item.rawDate ? `, fecha ${item.rawDate}` : ''}, categoría ${item.category}`}>
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
                  {item.rawDate && <Text style={styles.cardDate}>{item.rawDate}</Text>}
                </View>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardSubtitle}>{item.venue}</Text>
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
                <Ionicons name="map-outline" size={18} color="#7c3aed" />
                <Text style={[styles.actionButtonText, { color: '#7c3aed' }]}>Buscar lugar</Text>
              </Pressable>

              <Pressable
                onPress={() => handleShare(item)}
                style={styles.actionButton}
                accessibilityRole="button"
                accessibilityLabel="Compartir este evento">
                <Ionicons name="share-outline" size={18} color="#475569" />
                <Text style={styles.actionButtonText}>Compartir</Text>
              </Pressable>

              <Pressable
                disabled={!calendarUrl(item)}
                accessibilityState={{ disabled: !calendarUrl(item) }}
                onPress={() => handleAddToCalendar(item)}
                style={styles.actionButton}
                accessibilityRole="button"
                accessibilityLabel="Añadir a mi calendario">
                <Ionicons name="calendar-outline" size={18} color="#475569" />
                <Text style={styles.actionButtonText}>{calendarUrl(item) ? 'Calendario' : 'Sin fecha'}</Text>
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
    backgroundColor: '#f5f3ff',
    borderWidth: 1,
    borderColor: '#ddd6fe',
    borderRadius: 18,
    padding: 18,
    gap: 6,
  },
  heroEyebrow: {
    color: '#7c3aed',
    textTransform: 'uppercase',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  heroTitle: {
    color: '#1e1b4b',
    fontSize: 22,
    fontWeight: '800',
  },
  heroText: {
    color: '#4338ca',
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
    color: '#7c3aed',
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

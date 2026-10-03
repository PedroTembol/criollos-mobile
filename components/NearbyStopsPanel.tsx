import React, { useRef } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { NearbyStop, NearbyStopRoute } from './transportTypes';
import { createContentActionRunner } from './contentActions';

interface Props {
  stops?: NearbyStop[];
  onStopPress?: (stop: NearbyStop) => void;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => unknown;
}

export function NearbyStopsPanel({ stops, onStopPress, isLoading, isError, onRetry }: Props) {
  const run = useRef(createContentActionRunner());
  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Buscando paradas cercanas...</Text>
      </View>
    );
  }

  if (isError && !stops?.length) return <View style={styles.container} accessibilityLiveRegion="polite">
    <Text style={styles.loadingText}>No pudimos consultar las paradas cercanas.</Text>
    {onRetry && <Pressable onPress={() => { void run.current(onRetry); }} accessibilityRole="button" accessibilityLabel="Reintentar paradas cercanas">
      <Text style={styles.distanceText}>Reintentar</Text>
    </Pressable>}
  </View>;

  if (!stops || stops.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📍 Paradas Cercanas</Text>
        <Text style={styles.subtitle}>{stops.length} encontradas</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        accessibilityLabel="Lista de paradas de trolley cercanas a tu ubicación"
      >
        {stops.map((stop) => (
          <Pressable
            key={stop.markerId}
            style={styles.stopCard}
            onPress={() => { void run.current(() => onStopPress?.(stop)); }}
            disabled={!onStopPress}
            accessibilityState={{ disabled: !onStopPress }}
            accessibilityRole="button"
            accessibilityLabel={`${stop.name}, a ${stop.distanceLabel}. Servida por ${stop.routeCount} rutas.`}
          >
            <View style={styles.stopInfo}>
              <Text style={styles.stopName} numberOfLines={1}>{stop.name}</Text>
              <Text style={styles.distanceText}>{stop.distanceLabel}</Text>
            </View>

            <View style={styles.routesContainer}>
              {stop.routes.slice(0, 3).map((route: NearbyStopRoute) => (
                <View
                  key={route.routeId}
                  style={[styles.routeBadge, { backgroundColor: route.routeColor || '#94a3b8' }]}
                  accessibilityLabel={`Ruta ${route.routeName}`}
                >
                  <Text style={styles.routeText} numberOfLines={1}>
                    {route.routeName?.split(' ')[0] || route.routeId}
                  </Text>
                </View>
              ))}
              {stop.routeCount > 3 && (
                <Text style={styles.moreRoutes}>+{stop.routeCount - 3}</Text>
              )}
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    marginHorizontal: 10,
    marginBottom: 10,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1e293b',
  },
  subtitle: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  loadingText: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    padding: 10,
  },
  scrollContent: {
    paddingRight: 10,
  },
  stopCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 10,
    marginRight: 10,
    minWidth: 140,
    maxWidth: 180,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  stopInfo: {
    marginBottom: 8,
  },
  stopName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 2,
  },
  distanceText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1e40af',
  },
  routesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  routeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    maxWidth: 45,
  },
  routeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#fff',
  },
  moreRoutes: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
  },
});

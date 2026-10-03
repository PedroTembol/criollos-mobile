import React from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { TrackingSnapshot, TrackingRouteSummary } from './transportTypes';

interface Props {
  snapshot?: TrackingSnapshot;
  onRoutePress?: (routeId: number) => void;
}

export function TrackingDashboard({ snapshot, onRoutePress }: Props) {
  if (!snapshot || !snapshot.summary) return null;

  const { summary } = snapshot;

  const healthColors: Record<string, string> = {
    operational: '#22c55e',
    delayed: '#f59e0b',
    offline: '#ef4444',
    'no-signal': '#94a3b8',
  };

  const serviceStatusColors: Record<string, string> = {
    healthy: '#22c55e',
    degraded: '#f59e0b',
    offline: '#ef4444',
  };

  const serviceStatusLabels: Record<string, string> = {
    healthy: 'Señales recientes',
    degraded: 'Señales parciales o anteriores',
    offline: 'Sin señales recientes',
  };
  const noRecentSignals = summary.liveVehicles === 0;
  const serviceStatusLabel = noRecentSignals ? 'Sin señales recientes' : serviceStatusLabels[summary.serviceHealth.status];

  return (
    <View style={styles.container}>
      <View
        style={styles.serviceHealth}
        accessible
        accessibilityRole="summary"
        accessibilityLabel={`Estado de señales: ${serviceStatusLabel ?? 'estado desconocido'}, ${summary.serviceHealth.liveCoveragePercent}% de cobertura en vivo. Esto no confirma si el servicio está operando.`}>
        <View style={[styles.statusIndicator, { backgroundColor: noRecentSignals ? '#94a3b8' : serviceStatusColors[summary.serviceHealth.status] || '#94a3b8' }]} />
        <Text style={styles.serviceStatusText}>{serviceStatusLabel}</Text>
        <Text style={styles.coverageText}>{summary.serviceHealth.liveCoveragePercent}% en vivo</Text>
      </View>
      {noRecentSignals && <Text style={styles.nextStop}>La falta de señales no confirma si el servicio está operando.</Text>}

      <View
        style={styles.header}
        accessible
        accessibilityRole="summary"
        accessibilityLabel={`${summary.liveVehicles} trolleys en vivo, ${summary.movingVehicles} moviéndose, ${summary.routes.length} rutas monitoreadas.`}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{summary.liveVehicles}</Text>
          <Text style={styles.statLabel}>En vivo</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{summary.movingVehicles}</Text>
          <Text style={styles.statLabel}>Moviéndose</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{summary.routes.length}</Text>
          <Text style={styles.statLabel}>Rutas</Text>
        </View>
      </View>

      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.routesScroll}
        accessibilityLabel="Resumen por ruta de trolley"
      >
        {summary.routes.map((route: TrackingRouteSummary) => {
          const routeLabel = route.routeName || `Ruta ${route.routeId}`;
          const routeHasRecentSignal = route.liveVehicles > 0;
          const nextStopLabel = routeHasRecentSignal && route.nextStops.length > 0
            ? `Próxima parada ${route.nextStops[0]}`
            : 'Sin señal reciente';

          return (
          <Pressable 
            key={route.routeId} 
            style={[styles.routeCard, { borderLeftColor: route.routeColor || '#ccc' }]}
            onPress={() => onRoutePress?.(route.routeId)}
            accessibilityRole="button"
            accessibilityLabel={`${routeLabel}. ${route.liveVehicles} vehículos con señal reciente, ${route.movingVehicles} moviéndose según la última consulta. ${nextStopLabel}.`}
          >
            <View style={styles.routeHeader}>
              <Text style={styles.routeName} numberOfLines={1}>{route.routeName || `Ruta ${route.routeId}`}</Text>
              <View style={[styles.healthDot, { backgroundColor: healthColors[route.healthLabel] || '#94a3b8' }]} />
            </View>
            <View style={styles.routeStats}>
              <Text style={styles.routeMeta}>
                {route.liveVehicles} live · {route.movingVehicles} mov
              </Text>
            </View>
            {routeHasRecentSignal && route.nextStops.length > 0 ? (
              <Text style={styles.nextStop} numberOfLines={1}>
                Próxima: {route.nextStops[0]}
              </Text>
            ) : (
              <Text style={styles.nextStop} numberOfLines={1}>
                Sin señal reciente
              </Text>
            )}
          </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    margin: 10,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  serviceHealth: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 6,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  serviceStatusText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  coverageText: {
    fontSize: 10,
    color: '#64748b',
    marginLeft: 'auto',
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  stat: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e3a8a',
  },
  statLabel: {
    fontSize: 10,
    color: '#64748b',
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  divider: {
    width: 1,
    height: '60%',
    backgroundColor: '#e2e8f0',
    alignSelf: 'center',
  },
  routesScroll: {
    paddingRight: 10,
  },
  routeCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 10,
    marginRight: 10,
    minWidth: 150,
    maxWidth: 190,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  routeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  healthDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  routeName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
    flex: 1,
    marginRight: 4,
  },
  routeStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  routeMeta: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
  nextStop: {
    fontSize: 10,
    color: '#1e40af',
    fontWeight: '600',
  },
});

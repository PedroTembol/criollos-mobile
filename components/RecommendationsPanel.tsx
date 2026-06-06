import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { useRecommendationsQuery } from './transportQueries';
import type { CriolloRecommendation, RecommendationType } from './transportTypes';

const TYPE_META: Record<
  RecommendationType,
  { label: string; icon: string; color: string; bg: string }
> = {
  mobility: { label: 'Transporte', icon: '🚌', color: '#1d4ed8', bg: '#eff6ff' },
  plan:     { label: 'Plan',        icon: '🗺️',  color: '#7c3aed', bg: '#f5f3ff' },
  food:     { label: 'Gastronomía', icon: '🍴', color: '#b45309', bg: '#fffbeb' },
  service:  { label: 'Servicio',    icon: '⚠️',  color: '#b91c1c', bg: '#fef2f2' },
};

function RecommendationCard({ item }: { item: CriolloRecommendation }) {
  const meta = TYPE_META[item.type] ?? TYPE_META.service;

  const handlePress = () => {
    const href = item.actionHref;
    if (href.startsWith('http')) {
      Linking.openURL(href).catch(() => null);
    }
  };

  return (
    <View
      style={[styles.card, { borderLeftColor: meta.color }]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Recomendación de ${meta.label}${item.priority === 'high' ? ' (Alta prioridad)' : ''}: ${item.title}. ${item.message}`}>
      <View style={styles.cardTop} importantForAccessibility="no-hide-descendants">
        <View style={[styles.typeBadge, { backgroundColor: meta.bg }]}>
          <Text style={[styles.typeIcon]}>{meta.icon}</Text>
          <Text style={[styles.typeLabel, { color: meta.color }]}>{meta.label}</Text>
        </View>
        {item.priority === 'high' && (
          <View style={styles.priorityBadge}>
            <Text style={styles.priorityText}>Alta prioridad</Text>
          </View>
        )}
      </View>
      <Text style={styles.cardTitle}>{item.title}</Text>
      <Text style={styles.cardMessage}>{item.message}</Text>
      {item.evidence.length > 0 && (
        <View style={styles.evidenceRow}>
          {item.evidence.slice(0, 2).map((e, i) => (
            <Text key={i} style={styles.evidencePill}>
              {e}
            </Text>
          ))}
        </View>
      )}
      {item.actionHref.startsWith('http') && (
        <Pressable
          style={styles.actionButton}
          onPress={handlePress}
          accessibilityRole="link"
          accessibilityLabel={item.actionLabel}>
          <Text style={styles.actionButtonText}>{item.actionLabel} →</Text>
        </Pressable>
      )}
    </View>
  );
}

export function RecommendationsPanel() {
  const { data, isLoading, isError } = useRecommendationsQuery({ limit: 4 });

  // Silently skip if still loading or errored — don't block the main feed
  if (isLoading || isError || !data) return null;

  const visible = data.data.filter(
    (r) => r.priority === 'high' || r.priority === 'medium',
  );

  if (visible.length === 0) return null;

  return (
    <View
      style={styles.container}
      accessibilityLabel="Panel de sugerencias para Caguas">
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🍍 Sugerencias para ti</Text>
        <Text style={styles.headerCount}>{visible.length} activas</Text>
      </View>
      {visible.map((item) => (
        <RecommendationCard key={item.id} item={item} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  headerCount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  card: {
    marginHorizontal: 12,
    marginBottom: 10,
    padding: 14,
    backgroundColor: '#fafafa',
    borderRadius: 10,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typeIcon: {
    fontSize: 12,
  },
  typeLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  priorityBadge: {
    backgroundColor: '#fef2f2',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#b91c1c',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    lineHeight: 20,
  },
  cardMessage: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  evidenceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  evidencePill: {
    fontSize: 11,
    color: '#64748b',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  actionButton: {
    marginTop: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#1e40af',
    borderRadius: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});

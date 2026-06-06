import React from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable, Image } from 'react-native';
import type { DiscoverySummary, DiscoverySummaryAlert } from './transportTypes';

interface DiscoverySummaryPanelProps {
  summary?: DiscoverySummary;
  onSelectCategory?: (category: string) => void;
}

export function DiscoverySummaryPanel({ summary, onSelectCategory }: DiscoverySummaryPanelProps) {
  if (!summary) return null;

  const { alerts, categories } = summary;

  return (
    <View style={styles.container}>
      {alerts && alerts.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Avisos Criollos 🍍</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.alertsScroll}>
            {alerts.map((alert) => (
              <View key={alert.id} style={[styles.alertCard, alert.severity === 'warning' && styles.alertWarning]}>
                <Text style={styles.alertTitle}>{alert.title}</Text>
                <Text style={styles.alertMessage}>{alert.message}</Text>
                {alert.date && <Text style={styles.alertMeta}>{alert.date}</Text>}
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {categories && categories.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionSubtitle}>Explorar por categoría</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesScroll}>
            {categories.slice(0, 10).map((cat) => (
              <Pressable
                key={cat}
                style={styles.categoryChip}
                onPress={() => onSelectCategory?.(cat)}
                accessibilityRole="button"
                accessibilityLabel={`Filtrar por ${cat}`}>
                <Text style={styles.categoryText}>{cat}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    paddingHorizontal: 20,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  alertsScroll: {
    paddingHorizontal: 16,
    gap: 12,
  },
  alertCard: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 12,
    padding: 12,
    width: 260,
  },
  alertWarning: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e40af',
    marginBottom: 4,
  },
  alertMessage: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
  alertMeta: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 6,
    fontWeight: '600',
  },
  categoriesScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryChip: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
});

import React from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { EventosFeaturedPlan, EventosSummary } from './transportTypes';

interface EventosSummaryPanelProps {
  summary?: EventosSummary;
  onSelectCategory?: (category: string) => void;
  onSelectPlan?: (plan: EventosFeaturedPlan) => void;
}

export function EventosSummaryPanel({ summary, onSelectCategory, onSelectPlan }: EventosSummaryPanelProps) {
  if (!summary) return null;

  const { alerts, featuredPlans, categories } = summary;

  return (
    <View style={styles.container}>
      {alerts && alerts.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionSubtitle}>Próximos Pulsos 🍍</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {alerts.map((alert) => (
              <View key={alert.id} style={[styles.alertCard, alert.severity === 'warning' && styles.alertWarning]}>
                <View style={styles.alertHeader}>
                  <Ionicons
                    name={alert.scope === 'weekend' ? "calendar" : "flash"}
                    size={16}
                    color={alert.severity === 'warning' ? '#92400e' : '#1e40af'}
                  />
                  <Text style={[styles.alertTitle, alert.severity === 'warning' && styles.alertTitleWarning]}>
                    {alert.title}
                  </Text>
                </View>
                <Text style={styles.alertMessage}>{alert.message}</Text>
                {alert.date && <Text style={styles.alertMeta}>{alert.date}</Text>}
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {featuredPlans && featuredPlans.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionSubtitle}>Planes destacados</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {featuredPlans.map((plan) => (
              <Pressable key={plan.id} style={styles.planCard} onPress={() => onSelectPlan?.(plan)}
                disabled={!onSelectPlan} accessibilityRole="button" accessibilityState={{ disabled: !onSelectPlan }}
                accessibilityLabel={`Ver ${plan.primaryEventTitle}`}>
                <Text style={styles.planEyebrow}>{plan.eyebrow}</Text>
                <Text style={styles.planTitle} numberOfLines={1}>{plan.title}</Text>
                <Text style={styles.planBody} numberOfLines={2}>{plan.body}</Text>
                <View style={styles.planFooter}>
                  <Text style={styles.planMeta} numberOfLines={1}>{plan.meta}</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {categories && categories.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionSubtitle}>Explorar por categoría</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {categories.map((cat) => (
              <Pressable
                key={cat}
                style={styles.categoryChip}
                onPress={() => onSelectCategory?.(cat)}
                accessibilityRole="button"
                accessibilityLabel={`Filtrar eventos por ${cat}`}>
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
  sectionSubtitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
    paddingHorizontal: 20,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  alertCard: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 14,
    padding: 14,
    width: 280,
  },
  alertWarning: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1e40af',
  },
  alertTitleWarning: {
    color: '#92400e',
  },
  alertMessage: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
  alertMeta: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 8,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  planCard: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 14,
    width: 240,
    gap: 4,
  },
  planEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6366f1',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  planTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  planBody: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  planFooter: {
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 8,
  },
  planMeta: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  categoryChip: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
});

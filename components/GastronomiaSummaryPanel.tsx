import React from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { GastronomiaSummary, GastronomiaCategorySpotlight, GastronomiaSuggestedRoute, GastronomiaFeaturedPlace } from './transportTypes';

interface GastronomiaSummaryPanelProps {
  summary?: GastronomiaSummary;
  onSelectCategory?: (category: string) => void;
  onSelectRoute?: (route: GastronomiaSuggestedRoute) => void;
  onSelectPlace?: (placeId: string) => void;
}

export function GastronomiaSummaryPanel({ summary, onSelectCategory, onSelectRoute, onSelectPlace }: GastronomiaSummaryPanelProps) {
  if (!summary) return null;

  const { spotlights, alerts, categories, suggestedRoutes, featuredPlaces } = {
    spotlights: summary.categorySpotlights,
    alerts: summary.alerts,
    categories: summary.categories,
    suggestedRoutes: summary.suggestedRoutes,
    featuredPlaces: summary.featuredPlaces,
  };

  return (
    <View style={styles.container}>
      {alerts && alerts.length > 0 && (
        <View style={styles.section}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.alertsScroll}>
            {alerts.map((alert) => (
              <View key={alert.id} style={[styles.alertCard, alert.severity === 'warning' && styles.alertWarning]}>
                <Text style={styles.alertTitle}>{alert.title}</Text>
                <Text style={styles.alertMessage}>{alert.message}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {suggestedRoutes && suggestedRoutes.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rutas sugeridas 🍍</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.routesScroll}>
            {suggestedRoutes.map((route) => (
              <Pressable
                key={route.id}
                style={styles.routeCard}
                onPress={() => onSelectRoute?.(route)}
                accessibilityRole="button"
                accessibilityLabel={`Explorar ${route.title}`}>
                <View style={styles.routeHeader}>
                  <View style={styles.routeIcon}>
                    <Ionicons name="restaurant-outline" size={20} color="#fff" />
                  </View>
                  <Text style={styles.routeTitle}>{route.title}</Text>
                </View>
                <Text style={styles.routeDescription} numberOfLines={2}>
                  {route.description}
                </Text>
                <View style={styles.routeFooter}>
                  <Text style={styles.routeMeta}>{route.count} paradas</Text>
                  <Ionicons name="arrow-forward" size={14} color="#2563eb" />
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {featuredPlaces && featuredPlaces.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Antojos destacados 🍍</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featuredScroll}>
            {featuredPlaces.map((place) => (
              <Pressable
                key={place.id}
                style={styles.featuredCard}
                onPress={() => onSelectPlace?.(place.id)}
                accessibilityRole="button"
                accessibilityLabel={`Ver detalles de ${place.title}`}>
                {place.imageUrl && (
                  <Image 
                    source={{ uri: place.imageUrl }} 
                    style={styles.featuredImage} 
                    accessibilityLabel={place.imageAlt || `Foto de ${place.title}`}
                  />
                )}
                <View style={styles.featuredContent}>
                  <Text style={styles.featuredCategory}>{place.category}</Text>
                  <Text style={styles.featuredTitle}>{place.title}</Text>
                  <Text style={styles.featuredReason} numberOfLines={2}>
                    {place.reason}
                  </Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {spotlights && spotlights.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Focos por categoría 🍍</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.spotlightsScroll}>
            {spotlights.map((spotlight) => (
              <Pressable
                key={spotlight.id}
                style={styles.spotlightCard}
                onPress={() => onSelectCategory?.(spotlight.category)}
                accessibilityRole="button"
                accessibilityLabel={`Ver ${spotlight.category}`}>
                {spotlight.leadingPlaceImageUrl && (
                  <Image 
                    source={{ uri: spotlight.leadingPlaceImageUrl }} 
                    style={styles.spotlightImage} 
                    accessibilityLabel={spotlight.leadingPlaceImageAlt || `Foto de ${spotlight.category}`}
                  />
                )}
                <View style={styles.spotlightContent}>
                  <Text style={styles.spotlightCategory}>{spotlight.category}</Text>
                  <Text style={styles.spotlightTitle}>{spotlight.title}</Text>
                  <Text style={styles.spotlightMeta}>{spotlight.count} lugares</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {categories && categories.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionSubtitle}>Explorar sabores</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesScroll}>
            {categories.map((cat) => (
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
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
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
    width: 280,
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
  routesScroll: {
    paddingHorizontal: 16,
    gap: 12,
  },
  routeCard: {
    width: 240,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  routeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  routeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  routeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
  },
  routeDescription: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  },
  routeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  routeMeta: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563eb',
  },
  featuredScroll: {
    paddingHorizontal: 16,
    gap: 12,
  },
  featuredCard: {
    width: 220,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  featuredImage: {
    height: 120,
    width: '100%',
  },
  featuredContent: {
    padding: 12,
    gap: 4,
  },
  featuredCategory: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1d4ed8',
    textTransform: 'uppercase',
  },
  featuredTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  featuredReason: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 16,
  },
  spotlightsScroll: {
    paddingHorizontal: 16,
    gap: 12,
  },
  spotlightCard: {
    width: 160,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  spotlightImage: {
    height: 100,
    width: '100%',
  },
  spotlightContent: {
    padding: 12,
    gap: 2,
  },
  spotlightCategory: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2563eb',
    textTransform: 'uppercase',
  },
  spotlightTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  spotlightMeta: {
    fontSize: 11,
    color: '#64748b',
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

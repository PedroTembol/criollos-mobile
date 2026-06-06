import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  ScrollView,
  Pressable,
} from 'react-native';

type DiscoveryType = 'evento' | 'gastronomia' | 'info';

interface DiscoverySearchProps {
  onSearch: (filters: { q?: string; types?: DiscoveryType[]; categories?: string[] }) => void;
  availableCategories?: string[];
  hideTypes?: boolean;
}

export const DiscoverySearch = ({ onSearch, availableCategories = [], hideTypes = false }: DiscoverySearchProps) => {
  const [q, setQ] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<DiscoveryType[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const types: { label: string; value: DiscoveryType }[] = [
    { label: 'Eventos', value: 'evento' },
    { label: 'Gastronomía', value: 'gastronomia' },
  ];

  const toggleType = (type: DiscoveryType) => {
    const next = selectedTypes.includes(type)
      ? selectedTypes.filter((t) => t !== type)
      : [...selectedTypes, type];
    setSelectedTypes(next);
    onSearch({ q, types: next, categories: selectedCategories });
  };

  const toggleCategory = (cat: string) => {
    const next = selectedCategories.includes(cat)
      ? selectedCategories.filter((c) => c !== cat)
      : [...selectedCategories, cat];
    setSelectedCategories(next);
    onSearch({ q, types: selectedTypes, categories: next });
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <TextInput
          style={styles.input}
          placeholder="Buscar eventos o lugares..."
          placeholderTextColor="#94a3b8"
          value={q}
          accessibilityLabel="Buscar eventos o lugares"
          accessibilityHint="Filtra la lista de descubrimiento mientras escribes"
          returnKeyType="search"
          onChangeText={(text) => {
            setQ(text);
            onSearch({ q: text, types: selectedTypes, categories: selectedCategories });
          }}
        />
      </View>

      {!hideTypes && (
        <View style={styles.filterRow}>
          {types.map((t) => (
            <Pressable
              key={t.value}
              onPress={() => toggleType(t.value)}
              accessibilityRole="checkbox"
              accessibilityLabel={`Filtrar por ${t.label}`}
              accessibilityState={{ checked: selectedTypes.includes(t.value) }}
              style={[
                styles.chip,
                selectedTypes.includes(t.value) && styles.chipActive,
              ]}>
              <Text style={[styles.chipText, selectedTypes.includes(t.value) && styles.chipTextActive]}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {availableCategories.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
          {availableCategories.map((cat) => (
            <Pressable
              key={cat}
              onPress={() => toggleCategory(cat)}
              accessibilityRole="checkbox"
              accessibilityLabel={`Filtrar por categoría ${cat}`}
              accessibilityState={{ checked: selectedCategories.includes(cat) }}
              style={[
                styles.catChip,
                selectedCategories.includes(cat) && styles.catChipActive,
              ]}>
              <Text style={[styles.catChipText, selectedCategories.includes(cat) && styles.catChipTextActive]}>
                {cat}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 12,
    backgroundColor: '#fff',
  },
  searchBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  input: {
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#0f172a',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginTop: 4,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chipActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  chipTextActive: {
    color: '#2563eb',
  },
  categoriesScroll: {
    marginTop: 12,
    paddingLeft: 16,
  },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    marginRight: 8,
  },
  catChipActive: {
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
  },
  catChipText: {
    fontSize: 12,
    color: '#64748b',
  },
  catChipTextActive: {
    color: '#0f172a',
    fontWeight: '600',
  },
});

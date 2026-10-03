import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatContentDate } from './contentDates';

export function ContentDateRange({ from, to, error, onClear }: { from?: string; to?: string; error?: string; onClear: () => void }) {
  if (!from && !to && !error) return null;
  return <View style={styles.container} accessibilityLiveRegion="polite">
    <Text style={styles.text}>{error || [from && `Desde ${formatContentDate(from)}`, to && `Hasta ${formatContentDate(to)}`, '(Puerto Rico)'].filter(Boolean).join(' · ')}</Text>
    <Pressable onPress={onClear} accessibilityRole="button" accessibilityLabel="Limpiar fechas">
      <Text style={styles.link}>Limpiar fechas</Text>
    </Pressable>
  </View>;
}
const styles = StyleSheet.create({
  container: { marginHorizontal: 16, padding: 12, gap: 8, backgroundColor: '#eff6ff', borderRadius: 12 },
  text: { color: '#334155', lineHeight: 20 },
  link: { color: '#2563eb', fontWeight: '700' },
});

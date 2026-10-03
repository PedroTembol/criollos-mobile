import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { describeFeedState, type FeedMetadata } from './feedState';
import { createContentActionRunner } from './contentActions';

type Props = { data?: FeedMetadata; dataUpdatedAt: number; isError: boolean; isFetching: boolean; onRetry: () => unknown };
export function FeedStatus({ data, dataUpdatedAt, isError, isFetching, onRetry }: Props) {
  const [now, setNow] = useState(Date.now);
  const retry = useRef(createContentActionRunner());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer); }, []);
  if (!data) return null;
  const state = describeFeedState(data, dataUpdatedAt, isError, now);
  return <View style={styles.status} accessibilityLiveRegion="polite">
    <Text style={styles.text}>{state.text}{state.minutes !== null ? ` ${state.timestampLabel} hace ${state.minutes} min.` : ''}</Text>
    {state.partial && (state.stale || state.failed) ? <Text style={styles.text}>El catálogo está incompleto; puede haber más contenido.</Text> : null}
    {data.warning ? <Text style={styles.text}>{data.warning}</Text> : null}
    <Pressable onPress={() => { void retry.current(onRetry); }} disabled={isFetching} accessibilityRole="button" accessibilityState={{ disabled: isFetching }} accessibilityLabel="Actualizar contenido">
      <Text style={styles.link}>{isFetching ? 'Actualizando…' : 'Actualizar'}</Text>
    </Pressable>
  </View>;
}

export function FeedEmptyState({ isLoading, isError, isFetching, onRetry, onClear, title, message }: {
  isLoading: boolean; isError: boolean; isFetching: boolean; onRetry: () => unknown; onClear?: () => void; title: string; message: string;
}) {
  const retry = useRef(createContentActionRunner());
  if (isLoading) return <View style={styles.empty}><ActivityIndicator accessibilityLabel="Cargando contenido" /><Text style={styles.text}>Cargando…</Text></View>;
  return <View style={styles.empty} accessibilityLiveRegion="polite">
    <Text style={styles.title}>{isError ? 'No pudimos cargar el contenido.' : title}</Text>
    <Text style={styles.text}>{isError ? 'Comprueba tu conexión e inténtalo de nuevo.' : message}</Text>
    <Pressable onPress={() => { void retry.current(onRetry); }} disabled={isFetching} accessibilityRole="button" accessibilityState={{ disabled: isFetching }} accessibilityLabel="Reintentar contenido"><Text style={styles.link}>{isFetching ? 'Cargando…' : 'Reintentar'}</Text></Pressable>
    {!isError && onClear && <Pressable onPress={onClear} accessibilityRole="button"><Text style={styles.link}>Limpiar filtros</Text></Pressable>}
  </View>;
}
const styles = StyleSheet.create({
  status: { marginHorizontal: 16, padding: 12, gap: 8, backgroundColor: '#f8fafc', borderRadius: 12 },
  empty: { padding: 24, alignItems: 'center', gap: 12 },
  title: { fontSize: 17, fontWeight: '700', color: '#0f172a', textAlign: 'center' },
  text: { color: '#64748b', lineHeight: 20, textAlign: 'center' },
  link: { color: '#2563eb', fontWeight: '700', textAlign: 'center' },
});

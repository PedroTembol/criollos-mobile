import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';

import { useFavorites } from '@/components/transportFavorites';
import { getApiBaseUrl, sendFeedback } from '@/components/transportApi';
import { useBootstrapQuery, useStopsQuery } from '@/components/transportQueries';
import { useTransportSettings } from '@/components/transportSettings';

export default function SettingsScreen() {
  const { lowDataMode, setLowDataMode, apiBaseUrl, setApiBaseUrl, positionRefreshMs } =
    useTransportSettings();
  const { favorites } = useFavorites();
  const stopsQuery = useStopsQuery();
  const bootstrapQuery = useBootstrapQuery();

  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackRating, setFeedbackRating] = useState('5');

  const feedbackMutation = useMutation({
    mutationFn: () =>
      sendFeedback(
        {
          message: feedbackMessage,
          rating: Number.parseFloat(feedbackRating),
          source: 'criollos-mobile',
        },
        apiBaseUrl ?? undefined,
      ),
    onSuccess: () => {
      setFeedbackMessage('');
      Alert.alert('Gracias', 'Tu feedback fue enviado.');
    },
    onError: () => {
      Alert.alert('Error', 'No se pudo enviar el feedback.');
    },
  });

  const stops = stopsQuery.data?.stops ?? bootstrapQuery.data?.stops ?? [];
  const markers = bootstrapQuery.data?.markers ?? [];

  const stopLabel = (stopId: number) => {
    const stop = stops.find((item) => item.id === stopId);
    if (!stop) return `Parada ${stopId}`;
    if (stop.markerId != null) {
      const marker = markers.find((item) => item.id === stop.markerId);
      if (marker?.description) return marker.description;
    }
    return `Parada ${stop.id}`;
  };

  const defaultBaseUrl = useMemo(() => getApiBaseUrl(), []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.sectionTitle}>Configuracion de API</Text>
      <Text style={styles.helperText}>Base URL por defecto: {defaultBaseUrl}</Text>
      <TextInput
        style={styles.input}
        placeholder="Override Base URL (opcional)"
        value={apiBaseUrl ?? ''}
        onChangeText={setApiBaseUrl}
        autoCapitalize="none"
      />

      <View style={styles.row}>
        <Text style={styles.sectionTitle}>Modo bajo datos</Text>
        <Switch value={lowDataMode} onValueChange={setLowDataMode} />
      </View>
      <Text style={styles.helperText}>Polling de posiciones: {Math.round(positionRefreshMs / 1000)}s</Text>

      <Text style={styles.sectionTitle}>Favoritos</Text>
      {favorites.stopIds.length === 0 && favorites.places.length === 0 ? (
        <Text style={styles.helperText}>Aun no tienes favoritos.</Text>
      ) : (
        <>
          {favorites.stopIds.map((stopId) => (
            <View key={`fav-stop-${stopId}`} style={styles.listItem}>
              <Text style={styles.listTitle}>{stopLabel(stopId)}</Text>
              <Text style={styles.listMeta}>Parada</Text>
            </View>
          ))}
          {favorites.places.map((place) => (
            <View key={`fav-place-${place.id}`} style={styles.listItem}>
              <Text style={styles.listTitle}>{place.label}</Text>
              <Text style={styles.listMeta}>Lugar</Text>
            </View>
          ))}
        </>
      )}

      <Text style={styles.sectionTitle}>Feedback</Text>
      <TextInput
        style={styles.input}
        placeholder="Tu mensaje"
        value={feedbackMessage}
        onChangeText={setFeedbackMessage}
        multiline
      />
      <TextInput
        style={styles.input}
        placeholder="Rating (1-5)"
        value={feedbackRating}
        onChangeText={setFeedbackRating}
        keyboardType="numeric"
      />
      <Pressable
        style={[styles.primaryButton, feedbackMutation.isPending && styles.buttonDisabled]}
        onPress={() => feedbackMutation.mutate()}
        disabled={feedbackMutation.isPending || feedbackMessage.trim().length === 0}>
        <Text style={styles.primaryButtonText}>
          {feedbackMutation.isPending ? 'Enviando...' : 'Enviar feedback'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  helperText: {
    color: '#6b7280',
    fontSize: 13,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  listItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  listTitle: {
    fontWeight: '600',
  },
  listMeta: {
    color: '#6b7280',
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

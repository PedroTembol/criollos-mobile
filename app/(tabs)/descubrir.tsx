import { View, StyleSheet } from 'react-native';

import { DiscoveryFeed } from '@/components/DiscoveryFeed';
import { RecommendationsPanel } from '@/components/RecommendationsPanel';

export default function DiscoverScreen() {
  return (
    <View style={styles.container}>
      <RecommendationsPanel />
      <DiscoveryFeed />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
});

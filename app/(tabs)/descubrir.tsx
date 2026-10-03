import { View, StyleSheet } from 'react-native';

import { DiscoveryFeed } from '@/components/DiscoveryFeed';

export default function DiscoverScreen() {
  return (
    <View style={styles.container}>
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

import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ChunkyButton } from '../components/ChunkyButton';
import { Screen } from '../components/Screen';
import { SpeechBubble } from '../components/SpeechBubble';
import { TrolleyMascot } from '../components/TrolleyMascot';

/** Shown when the saved session can't be checked (server unreachable). */
export function ConnectionErrorScreen({ onRetry }: { onRetry: () => Promise<void> }) {
  const [retrying, setRetrying] = useState(false);
  const retry = async () => {
    setRetrying(true);
    await onRetry();
    setRetrying(false);
  };
  return (
    <Screen edges={['top', 'bottom']} style={styles.page}>
      <View style={styles.hero}>
        <SpeechBubble text="Can't reach the server" />
        <TrolleyMascot size={200} mood="oops" />
      </View>
      <ChunkyButton label={retrying ? 'Trying…' : 'Retry'} variant="blue" size="lg" disabled={retrying} onPress={() => void retry()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { justifyContent: 'space-between', paddingBottom: 12 },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
});

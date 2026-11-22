import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ChunkyButton } from '../components/ChunkyButton';
import { Screen } from '../components/Screen';
import { SwipeErrorBanner } from '../components/SwipeErrorBanner';
import { SpeechBubble } from '../components/SpeechBubble';
import { SwipeDeck } from '../components/SwipeDeck';
import { TrolleyMascot } from '../components/TrolleyMascot';
import { useFeed } from '../hooks/useFeed';
import { useLibrary } from '../hooks/useLibrary';
import { colors, fonts } from '../theme';

export function FeedScreen() {
  const { swipe } = useLibrary();
  const { deck, loading, error, refresh } = useFeed();
  const [area, setArea] = useState({ w: 0, h: 0 });

  // new events may have appeared while we were on another tab
  useFocusEffect(useCallback(() => void refresh(), [refresh]));

  const cardW = Math.min(area.w, 420);
  const cardH = Math.max(0, Math.min(area.h - 24, cardW * 1.45));

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>This week in Boston</Text>
        </View>
        <View style={styles.counter}>
          <Text style={styles.counterNum}>{deck.length}</Text>
          <Text style={styles.counterLabel}>left</Text>
        </View>
      </View>

      <SwipeErrorBanner />

      <View style={{ flex: 1, marginBottom: 78 }} onLayout={(e) => setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        {area.h > 0 && (
          <SwipeDeck
            deck={deck}
            cardWidth={cardW}
            cardHeight={cardH}
            onSwipe={(event, action) => swipe(event, action)}
            empty={
              loading ? (
                <View style={styles.empty}>
                  <SpeechBubble text="Finding events for you…" />
                  <TrolleyMascot size={180} mood="happy" />
                </View>
              ) : error ? (
                <View style={styles.empty}>
                  <SpeechBubble text={error} />
                  <TrolleyMascot size={180} mood="oops" />
                  <ChunkyButton label="Try again" variant="blue" onPress={() => void refresh()} style={styles.emptyBtn} />
                </View>
              ) : (
                <View style={styles.empty}>
                  <SpeechBubble text="No more events this week" />
                  <TrolleyMascot size={180} mood="sleepy" sign="LAST STOP" />
                  <Text style={styles.emptyHint}>Check your Saved tab, or look for new events.</Text>
                  <ChunkyButton label="Refresh" variant="green" onPress={() => void refresh()} style={styles.emptyBtn} />
                </View>
              )
            }
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6, paddingBottom: 10 },
  hello: { fontFamily: fonts.medium, fontSize: 15, color: colors.inkSoft },
  title: { fontFamily: fonts.bold, fontSize: 24, color: colors.ink },
  counter: {
    alignItems: 'center',
    backgroundColor: colors.yellow.base,
    borderWidth: 2.5,
    borderColor: colors.ink,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 2,
    transform: [{ rotate: '4deg' }],
  },
  counterNum: { fontFamily: fonts.bold, fontSize: 20, color: colors.ink, lineHeight: 24 },
  counterLabel: { fontFamily: fonts.semibold, fontSize: 11, color: colors.ink, marginTop: -4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 10 },
  emptyBtn: { alignSelf: 'stretch', marginTop: 8 },
  emptyHint: { fontFamily: fonts.medium, fontSize: 15, color: colors.inkSoft, textAlign: 'center' },
});

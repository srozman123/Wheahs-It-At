import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../components/Screen';
import { SpeechBubble } from '../components/SpeechBubble';
import { SwipeDeck } from '../components/SwipeDeck';
import { TrolleyMascot } from '../components/TrolleyMascot';
import { useAppState } from '../hooks/useAppState';
import { useFeed } from '../hooks/useFeed';
import { colors, fonts } from '../theme';

export function FeedScreen() {
  const { user, swipe } = useAppState();
  const { deck } = useFeed();
  const [area, setArea] = useState({ w: 0, h: 0 });

  const cardW = Math.min(area.w, 420);
  const cardH = Math.max(0, Math.min(area.h - 24, cardW * 1.45));

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text style={styles.hello}>Hey {user?.name || 'there'} 👋</Text>
          <Text style={styles.title}>This week in Boston</Text>
        </View>
        <View style={styles.counter}>
          <Text style={styles.counterNum}>{deck.length}</Text>
          <Text style={styles.counterLabel}>left</Text>
        </View>
      </View>

      <View style={{ flex: 1, marginBottom: 78 }} onLayout={(e) => setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        {area.h > 0 && (
          <SwipeDeck
            deck={deck}
            cardWidth={cardW}
            cardHeight={cardH}
            onSwipe={(event, action) => swipe(event.id, action)}
            empty={
              <View style={styles.empty}>
                <SpeechBubble text="End of the line! You've seen everything this week." />
                <TrolleyMascot size={180} mood="sleepy" sign="LAST STOP" />
                <Text style={styles.emptyHint}>Check your Saved tab, or come back when new events roll in.</Text>
              </View>
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
  emptyHint: { fontFamily: fonts.medium, fontSize: 15, color: colors.inkSoft, textAlign: 'center' },
});

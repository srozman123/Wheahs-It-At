import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { EventDetailModal } from '../components/EventDetailModal';
import { EventRow, RowButton } from '../components/EventRow';
import { Screen } from '../components/Screen';
import { SwipeErrorBanner } from '../components/SwipeErrorBanner';
import { SpeechBubble } from '../components/SpeechBubble';
import { TrolleyMascot } from '../components/TrolleyMascot';
import type { Card } from '../api';
import { useLibrary } from '../hooks/useLibrary';
import { colors, fonts, line } from '../theme';

export function SavedScreen() {
  const { saved: savedCards, swipe, refresh } = useLibrary();
  useFocusEffect(useCallback(() => void refresh(), [refresh]));
  const [open, setOpen] = useState<Card | null>(null);

  // upcoming first (soonest on top), expired at the bottom
  const saved = [...savedCards].sort((a, b) => {
      if (a.expired !== b.expired) return a.expired ? 1 : -1;
      return a.startsAt.localeCompare(b.startsAt);
    });

  return (
    <Screen>
      <Text style={styles.title}>Saved</Text>
      <SwipeErrorBanner />

      {saved.length === 0 ? (
        <View style={styles.empty}>
          <SpeechBubble text="Nothing saved yet. Swipe right on anything that looks fun!" />
          <TrolleyMascot size={150} mood="wink" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 120, paddingTop: 8 }} showsVerticalScrollIndicator={false}>
          {saved.map((e, i) => {
            const expired = e.expired;
            return (
              <EventRow
                key={e.id}
                event={e}
                index={i}
                onPress={() => setOpen(e)}
                actions={
                  expired ? (
                    <RowButton glyph="🗑" label="Remove" color={colors.inkSoft} soft={colors.paper} onPress={() => swipe(e, 'removed')} />
                  ) : (
                    <>
                      <RowButton glyph="✕" label="Pass" color={line.red.dark} soft={line.red.soft} onPress={() => swipe(e, 'pass')} />
                      <RowButton glyph="★" label="Going" color={line.green.dark} soft={line.green.soft} onPress={() => swipe(e, 'going')} />
                    </>
                  )
                }
              />
            );
          })}
        </ScrollView>
      )}
      <EventDetailModal event={open} onClose={() => setOpen(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.bold, fontSize: 30, color: colors.ink, paddingTop: 6 },
  sub: { fontFamily: fonts.medium, fontSize: 15, color: colors.inkSoft, marginBottom: 8 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, paddingBottom: 80 },
});

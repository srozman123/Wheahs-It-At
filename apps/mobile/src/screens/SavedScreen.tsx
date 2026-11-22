import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { EventDetailModal } from '../components/EventDetailModal';
import { EventRow, RowButton } from '../components/EventRow';
import { Screen } from '../components/Screen';
import { SpeechBubble } from '../components/SpeechBubble';
import { TrolleyMascot } from '../components/TrolleyMascot';
import { useAppState } from '../hooks/useAppState';
import type { Event } from '../mocks/types';
import { colors, fonts, line } from '../theme';
import { isExpired } from '../utils/time';

export function SavedScreen() {
  const { events, swipes, swipe } = useAppState();
  const [open, setOpen] = useState<Event | null>(null);

  // upcoming first (soonest on top), expired at the bottom
  const saved = events
    .filter((e) => swipes[e.id] === 'save')
    .sort((a, b) => {
      const ea = isExpired(a.startsAt);
      const eb = isExpired(b.startsAt);
      if (ea !== eb) return ea ? 1 : -1;
      return a.startsAt.localeCompare(b.startsAt);
    });

  return (
    <Screen>
      <Text style={styles.title}>Saved</Text>

      {saved.length === 0 ? (
        <View style={styles.empty}>
          <SpeechBubble text="Nothing saved yet. Swipe right on anything that looks fun!" />
          <TrolleyMascot size={150} mood="wink" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 120, paddingTop: 8 }} showsVerticalScrollIndicator={false}>
          {saved.map((e, i) => {
            const expired = isExpired(e.startsAt);
            return (
              <EventRow
                key={e.id}
                event={e}
                index={i}
                onPress={() => setOpen(e)}
                actions={
                  expired ? (
                    <RowButton glyph="🗑" label="Remove" color={colors.inkSoft} soft={colors.paper} onPress={() => swipe(e.id, 'removed')} />
                  ) : (
                    <>
                      <RowButton glyph="✕" label="Pass" color={line.red.dark} soft={line.red.soft} onPress={() => swipe(e.id, 'pass')} />
                      <RowButton glyph="★" label="Going" color={line.green.dark} soft={line.green.soft} onPress={() => swipe(e.id, 'going')} />
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

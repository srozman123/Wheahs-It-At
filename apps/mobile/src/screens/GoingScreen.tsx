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
import { dayLabel, isExpired } from '../utils/time';

const DAY_COLORS = [line.green, line.orange, line.blue, line.red, line.purple, line.yellow];

/** Your week, like a little itinerary grouped by day. */
export function GoingScreen() {
  const { events, swipes, swipe } = useAppState();
  const [open, setOpen] = useState<Event | null>(null);

  const going = events
    .filter((e) => swipes[e.id] === 'going')
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  const groups: { label: string; items: Event[] }[] = [];
  for (const e of going) {
    const label = isExpired(e.startsAt) ? 'Already happened' : dayLabel(e.startsAt);
    const g = groups.find((x) => x.label === label);
    if (g) g.items.push(e);
    else groups.push({ label, items: [e] });
  }

  let rowIndex = 0;

  return (
    <Screen>
      <Text style={styles.title}>Going</Text>
      <Text style={styles.sub}>Your week, all lined up.</Text>

      {going.length === 0 ? (
        <View style={styles.empty}>
          <SpeechBubble text="No plans yet! Swipe up on something you're going to." />
          <TrolleyMascot size={150} mood="sleepy" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 120, paddingTop: 8 }} showsVerticalScrollIndicator={false}>
          {groups.map((g, gi) => {
            const c = DAY_COLORS[gi % DAY_COLORS.length];
            return (
              <View key={g.label} style={styles.group}>
                {/* a "stop" on the line, like a subway map */}
                <View style={styles.stopRow}>
                  <View style={[styles.stopDot, { backgroundColor: c.base }]} />
                  <View style={[styles.dayPill, { backgroundColor: c.soft, borderColor: c.dark }]}>
                    <Text style={[styles.dayText, { color: c.dark }]}>{g.label}</Text>
                  </View>
                </View>
                <View style={[styles.track, { borderColor: c.base }]}>
                  {g.items.map((e) => (
                    <EventRow
                      key={e.id}
                      event={e}
                      index={rowIndex++}
                      onPress={() => setOpen(e)}
                      actions={
                        <RowButton glyph="✕" label="Remove" color={colors.inkSoft} soft={colors.paper} onPress={() => swipe(e.id, 'removed')} />
                      }
                    />
                  ))}
                </View>
              </View>
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
  group: { marginBottom: 6 },
  stopRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  stopDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 3, borderColor: colors.ink },
  dayPill: { borderWidth: 2.5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 3 },
  dayText: { fontFamily: fonts.bold, fontSize: 15 },
  track: { marginLeft: 9, borderLeftWidth: 4, paddingLeft: 16, paddingTop: 2 },
});

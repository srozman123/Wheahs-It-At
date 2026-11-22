import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, FadeIn, SlideInDown, useSharedValue, withTiming } from 'react-native-reanimated';
import type { Card } from '../api';
import { useFriends } from '../hooks/useFriends';
import { useGoingPeople } from '../hooks/useGoingPeople';
import { useLibrary } from '../hooks/useLibrary';
import { colors, FLIP_DURATION, fonts } from '../theme';
import { directionsUrl, openDirections } from '../utils/directions';
import { Avatar } from './Avatar';
import { ChunkyButton } from './ChunkyButton';
import { EventCard } from './EventCard';

/**
 * Opens a card from a list. Tap the card to flip it. If you're Going, you can
 * add other app users who are going (DESIGN.md → Friends → add people from events).
 */
export function EventDetailModal({ event, onClose }: { event: Card | null; onClose: () => void }) {
  return (
    <Modal transparent visible={event !== null} animationType="none" onRequestClose={onClose}>
      {event ? <Content event={event} onClose={onClose} /> : null}
    </Modal>
  );
}

function Content({ event, onClose }: { event: Card; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const { going } = useLibrary();
  const { friends, outgoing, sendRequest } = useFriends();
  const { others } = useGoingPeople(event.id);
  const flip = useSharedValue(0);
  const iAmGoing = going.some((c) => c.id === event.id);
  const mapsUrl = directionsUrl(event);
  const canNavigate = iAmGoing && !event.expired && mapsUrl !== null;

  const cardW = Math.min(width - 40, 400);
  const cardH = Math.min(height * 0.62, cardW * 1.4);

  return (
    <Animated.View entering={FadeIn.duration(150)} style={styles.backdrop}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Fills the (≥ screen-height) content area behind the column, so taps on empty space close. */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View entering={SlideInDown.duration(320).easing(Easing.out(Easing.cubic))} style={styles.column}>
          <Pressable
            onPress={() =>
              (flip.value = withTiming(flip.value > 0.5 ? 0 : 1, { duration: FLIP_DURATION, easing: Easing.inOut(Easing.cubic) }))
            }
          >
            <EventCard event={event} width={cardW} height={cardH} flip={flip} />
          </Pressable>

          {canNavigate ? (
            <ChunkyButton
              label="Staht goin!"
              accessibilityLabel="Get directions in Google Maps"
              variant="green"
              onPress={() => openDirections(mapsUrl)}
              style={{ width: cardW }}
            />
          ) : null}

          {iAmGoing && others.length > 0 ? (
            <View style={[styles.people, { width: cardW }]}>
              <Text style={styles.peopleTitle}>Also going — add them?</Text>
              {others.map((p) => {
                const isFriend = friends.some((u) => u.id === p.id);
                const requested = isFriend || outgoing.some((u) => u.id === p.id);
                return (
                  <View key={p.id} style={styles.personRow}>
                    <Avatar name={p.name} color={p.color} size={30} />
                    <Text style={styles.personName}>{p.name}</Text>
                    <Pressable
                      disabled={requested}
                      onPress={() => sendRequest(p.id).catch(() => {})}
                      style={[styles.addBtn, requested && { backgroundColor: colors.sand }]}
                    >
                      <Text style={styles.addText}>{isFriend ? 'Friends' : requested ? 'Requested' : '+ Add'}</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          ) : null}

          <Pressable onPress={onClose} style={styles.close}>
            <Text style={styles.closeText}>✕ Close</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(43,33,24,0.6)' },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 24 },
  column: { alignItems: 'center', gap: 14 },
  people: { backgroundColor: colors.paper, borderWidth: 3, borderColor: colors.ink, borderRadius: 20, padding: 12, gap: 8 },
  peopleTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  personName: { flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  addBtn: { backgroundColor: colors.blue.soft, borderWidth: 2.5, borderColor: colors.ink, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  addText: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  close: { backgroundColor: colors.paper, borderWidth: 2.5, borderColor: colors.ink, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 8 },
  closeText: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
});

import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, FadeIn, SlideInDown, useSharedValue, withTiming } from 'react-native-reanimated';
import { useAppState } from '../hooks/useAppState';
import { useGoingPeople } from '../hooks/useGoingPeople';
import type { Event } from '../mocks/types';
import { colors, FLIP_DURATION, fonts } from '../theme';
import { Avatar } from './Avatar';
import { EventCard } from './EventCard';

/**
 * Opens a card from a list. Tap the card to flip it. If you're Going, you can
 * add other app users who are going (DESIGN.md → Friends → add people from events).
 */
export function EventDetailModal({ event, onClose }: { event: Event | null; onClose: () => void }) {
  return (
    <Modal transparent visible={event !== null} animationType="none" onRequestClose={onClose}>
      {event ? <Content event={event} onClose={onClose} /> : null}
    </Modal>
  );
}

function Content({ event, onClose }: { event: Event; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const { swipes, friends, requestFriend } = useAppState();
  const { others } = useGoingPeople(event);
  const flip = useSharedValue(0);
  const iAmGoing = swipes[event.id] === 'going';

  const cardW = Math.min(width - 40, 400);
  const cardH = Math.min(height * 0.62, cardW * 1.4);

  return (
    <Animated.View entering={FadeIn.duration(150)} style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <Animated.View entering={SlideInDown.duration(320).easing(Easing.out(Easing.cubic))} style={{ alignItems: 'center', gap: 14 }}>
        <Pressable
          onPress={() =>
            (flip.value = withTiming(flip.value > 0.5 ? 0 : 1, { duration: FLIP_DURATION, easing: Easing.inOut(Easing.cubic) }))
          }
        >
          <EventCard event={event} width={cardW} height={cardH} flip={flip} />
        </Pressable>

        {iAmGoing && others.length > 0 ? (
          <View style={[styles.people, { width: cardW }]}>
            <Text style={styles.peopleTitle}>Also going — add them?</Text>
            {others.map((p) => {
              const existing = friends.find((f) => f.id === p.id);
              return (
                <View key={p.id} style={styles.personRow}>
                  <Avatar name={p.name} color={p.color} size={30} />
                  <Text style={styles.personName}>{p.name}</Text>
                  <Pressable
                    disabled={!!existing}
                    onPress={() => requestFriend(p.id, p.name, p.color)}
                    style={[styles.addBtn, existing && { backgroundColor: colors.sand }]}
                  >
                    <Text style={styles.addText}>{existing ? 'Requested' : '+ Add'}</Text>
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
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(43,33,24,0.6)', alignItems: 'center', justifyContent: 'center' },
  people: { backgroundColor: colors.paper, borderWidth: 3, borderColor: colors.ink, borderRadius: 20, padding: 12, gap: 8 },
  peopleTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  personName: { flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  addBtn: { backgroundColor: colors.blue.soft, borderWidth: 2.5, borderColor: colors.ink, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  addText: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  close: { backgroundColor: colors.paper, borderWidth: 2.5, borderColor: colors.ink, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 8 },
  closeText: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
});

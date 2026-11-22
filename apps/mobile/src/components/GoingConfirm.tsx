import { Modal, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeIn, ZoomIn } from 'react-native-reanimated';
import { useGoingPeople } from '../hooks/useGoingPeople';
import type { Event } from '../mocks/types';
import { colors, fonts, outline } from '../theme';
import { friendlyTime } from '../utils/time';
import { AvatarStack } from './Avatar';
import { ChunkyButton } from './ChunkyButton';
import { TrolleyMascot } from './TrolleyMascot';

/** The "are you sure?" sheet before marking Going (DESIGN.md: swipe up shows a confirmation first). */
export function GoingConfirm({ event, onConfirm, onCancel }: { event: Event | null; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Modal transparent visible={event !== null} animationType="none" onRequestClose={onCancel}>
      {event ? <Content event={event} onConfirm={onConfirm} onCancel={onCancel} /> : null}
    </Modal>
  );
}

function Content({ event, onConfirm, onCancel }: { event: Event; onConfirm: () => void; onCancel: () => void }) {
  const { friends } = useGoingPeople(event);
  return (
    <Animated.View entering={FadeIn.duration(150)} style={styles.backdrop}>
      <Animated.View entering={ZoomIn.duration(240).easing(Easing.out(Easing.cubic))} style={styles.sheet}>
        <View style={styles.mascot}>
          <TrolleyMascot size={120} mood="excited" sign="GOING!" />
        </View>
        <Text style={styles.title}>You're going?!</Text>
        <Text style={styles.event} numberOfLines={2}>
          {event.title}
        </Text>
        <Text style={styles.time}>{friendlyTime(event.startsAt)} · {event.location}</Text>
        {friends.length > 0 ? (
          <View style={styles.friends}>
            <AvatarStack people={friends} size={26} />
            <Text style={styles.friendsText}>
              {friends.map((f) => f.name).join(', ')} {friends.length === 1 ? 'is' : 'are'} going too
            </Text>
          </View>
        ) : null}
        <View style={{ gap: 10, alignSelf: 'stretch', marginTop: 8 }}>
          <ChunkyButton label="Yes, I'm going! 🎉" variant="green" onPress={onConfirm} />
          <ChunkyButton label="Hmm, not yet" variant="paper" size="sm" onPress={onCancel} />
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(43,33,24,0.55)', justifyContent: 'center', padding: 24 },
  sheet: {
    backgroundColor: colors.cream,
    borderRadius: 28,
    borderWidth: outline,
    borderColor: colors.ink,
    padding: 22,
    paddingTop: 70,
    alignItems: 'center',
    gap: 4,
  },
  mascot: { position: 'absolute', top: -70 },
  title: { fontFamily: fonts.bold, fontSize: 28, color: colors.ink },
  event: { fontFamily: fonts.semibold, fontSize: 18, color: colors.ink, textAlign: 'center' },
  time: { fontFamily: fonts.medium, fontSize: 15, color: colors.inkSoft },
  friends: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    backgroundColor: colors.green.soft,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.green.dark,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  friendsText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.green.dark, flexShrink: 1 },
});

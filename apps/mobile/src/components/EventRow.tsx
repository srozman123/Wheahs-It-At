import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition, ZoomOut } from 'react-native-reanimated';
import type { Card } from '../api';
import { colors, fonts, outline } from '../theme';
import { friendlyTime } from '../utils/time';
import { EventArt } from './EventArt';

/** List row used by the Saved and Going tabs. */
export function EventRow({ event, index, onPress, actions }: { event: Card; index: number; onPress: () => void; actions: ReactNode }) {
  const expired = event.expired;
  return (
    <Animated.View entering={FadeInDown.delay(index * 50).duration(250)} exiting={ZoomOut} layout={LinearTransition.duration(250)}>
      <Pressable onPress={onPress} style={({ pressed }) => [styles.row, expired && styles.expired, pressed && { transform: [{ scale: 0.98 }] }]}>
        <View style={styles.thumb}>
          <EventArt imageUrl={event.imageUrl} tags={event.tags} height={72} emojiSize={22} />
        </View>
        <View style={styles.text}>
          <Text style={styles.title} numberOfLines={1}>
            {event.title}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {expired ? 'Already happened' : friendlyTime(event.startsAt)}{event.location ? ` · ${event.location}` : ''}
          </Text>
          {event.friendsGoing > 0 && !expired ? (
            <View style={styles.friends}>
              <Text style={styles.friendsText}>{event.friendsGoing === 1 ? '1 friend going' : `${event.friendsGoing} friends going`}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.actions}>{actions}</View>
        {expired ? (
          <View style={styles.stamp}>
            <Text style={styles.stampText}>EXPIRED</Text>
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

/** Small round outlined action button for rows. */
export function RowButton({ glyph, color, soft, onPress, label }: { glyph: string; color: string; soft: string; onPress: () => void; label: string }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.rowBtn, { backgroundColor: soft, borderColor: color }, pressed && { transform: [{ scale: 0.9 }] }]}
    >
      <Text style={[styles.rowBtnText, { color }]}>{glyph}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.paper,
    borderWidth: outline,
    borderColor: colors.ink,
    borderRadius: 20,
    padding: 10,
    marginBottom: 12,
  },
  expired: { backgroundColor: colors.sand, opacity: 0.75 },
  thumb: { width: 72, height: 72, borderRadius: 14, borderWidth: 2.5, borderColor: colors.ink, overflow: 'hidden' },
  text: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.bold, fontSize: 17, color: colors.ink },
  meta: { fontFamily: fonts.medium, fontSize: 13, color: colors.inkSoft },
  friends: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  friendsText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.green.dark },
  actions: { flexDirection: 'row', gap: 6 },
  rowBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  rowBtnText: { fontFamily: fonts.bold, fontSize: 18 },
  stamp: {
    position: 'absolute',
    top: 8,
    right: 60,
    borderWidth: 2.5,
    borderColor: colors.red.base,
    borderRadius: 6,
    paddingHorizontal: 6,
    transform: [{ rotate: '-10deg' }],
    backgroundColor: colors.paper,
  },
  stampText: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.5, color: colors.red.base },
});

import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import type { Card } from '../api';
import { useGoingPeople } from '../hooks/useGoingPeople';
import { colors, fonts, outline } from '../theme';
import { friendlyTime, priceLabel } from '../utils/time';
import { Avatar } from './Avatar';
import { EventArt } from './EventArt';
import { Icon } from './Icon';
import { TagPill } from './TagPill';

type Props = {
  event: Card;
  width: number;
  height: number;
  /** 0 = front, 1 = back. Driven by the deck so a tap can flip it. */
  flip?: SharedValue<number>;
};

/** The flashcard. Front = quick look, back = full details (DESIGN.md → Card Layout). */
export function EventCard({ event, width, height, flip }: Props) {
  const frontStyle = useAnimatedStyle(() => {
    const f = flip?.value ?? 0;
    return {
      opacity: f < 0.5 ? 1 : 0,
      transform: [{ perspective: 1200 }, { rotateY: `${interpolate(f, [0, 1], [0, 180])}deg` }],
    };
  });
  const backStyle = useAnimatedStyle(() => {
    const f = flip?.value ?? 0;
    return {
      opacity: f >= 0.5 ? 1 : 0,
      transform: [{ perspective: 1200 }, { rotateY: `${interpolate(f, [0, 1], [-180, 0])}deg` }],
    };
  });

  return (
    <View style={{ width, height }}>
      {/* Each face carries its own solid shadow, so the shadow turns with the card during a flip. */}
      <Animated.View style={[styles.face, frontStyle]}>
        <View style={styles.shadow} />
        <Front event={event} height={height} />
      </Animated.View>
      <Animated.View style={[styles.face, backStyle]} pointerEvents="box-none">
        <View style={styles.shadow} />
        <Back event={event} />
      </Animated.View>
    </View>
  );
}

function Front({ event, height }: { event: Card; height: number }) {
  const artHeight = Math.round(height * 0.46);
  return (
    <View style={styles.card}>
      <View>
        <EventArt imageUrl={event.imageUrl} tags={event.tags} height={artHeight} />
        <View style={[styles.chip, styles.timeChip]}>
          <Icon name="clock" size={16} />
          <Text style={styles.chipText}>{friendlyTime(event.startsAt)}</Text>
        </View>
      </View>
      <View style={styles.divider} />
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {event.title}
        </Text>
        <View style={styles.row}>
          <Icon name="pin" size={18} color={colors.inkSoft} />
          <Text style={styles.meta}>{event.location ?? 'Location TBA'}</Text>
        </View>
        <View style={styles.tags}>
          {event.tags.slice(0, 3).map((t) => (
            <TagPill key={t} tag={t} />
          ))}
        </View>
        <View style={{ flex: 1 }} />
        <View style={styles.footer}>
          {event.friendsGoing > 0 ? (
            <Text style={styles.footerText}>
              {event.friendsGoing === 1 ? '1 friend going' : `${event.friendsGoing} friends going`}
            </Text>
          ) : (
            <Text style={[styles.footerText, { color: colors.inkSoft }]}>No friends going yet — be the first!</Text>
          )}
          <Text style={styles.flipHint}>tap to flip ↻</Text>
        </View>
      </View>
    </View>
  );
}

function Back({ event }: { event: Card }) {
  const { friends, others } = useGoingPeople(event.id);
  const everyone = [...friends, ...others];
  return (
    <View style={[styles.card, styles.back]}>
      <Text style={styles.backTitle} numberOfLines={2}>
        {event.title}
      </Text>
      {event.description ? (
        <Text style={styles.desc} numberOfLines={6}>
          {event.description}
        </Text>
      ) : null}

      <View style={styles.infoBox}>
        <InfoRow icon="clock" text={friendlyTime(event.startsAt)} />
        <InfoRow icon="pin" text={event.location ?? 'Location TBA'} />
        <InfoRow icon="ticket" text={priceLabel(event.priceMin, event.priceMax)} />
        {event.sourceUrl ? (
          <Pressable onPress={() => Linking.openURL(event.sourceUrl!)} hitSlop={8}>
            <InfoRow icon="link" text="View original listing" link />
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.sectionLabel}>WHO'S GOING</Text>
      {everyone.length === 0 ? (
        <Text style={styles.meta}>Nobody yet. Start the party 🎉</Text>
      ) : (
        <View style={styles.people}>
          {everyone.slice(0, 6).map((p) => (
            <View key={p.id} style={styles.person}>
              <Avatar name={p.name} color={p.color} size={30} />
              <Text style={styles.personName}>
                {p.name}
                {p.isFriend ? ' ★' : ''}
              </Text>
            </View>
          ))}
          {everyone.length > 6 ? <Text style={styles.meta}>+{everyone.length - 6} more</Text> : null}
        </View>
      )}
    </View>
  );
}

function InfoRow({ icon, text, link }: { icon: 'clock' | 'pin' | 'ticket' | 'link'; text: string; link?: boolean }) {
  return (
    <View style={styles.row}>
      <Icon name={icon} size={18} color={link ? colors.blue.base : colors.ink} />
      <Text style={[styles.info, link && { color: colors.blue.base, textDecorationLine: 'underline' }]} numberOfLines={2}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  face: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backfaceVisibility: 'hidden' },
  shadow: { position: 'absolute', top: 7, left: 0, right: 0, bottom: -7, backgroundColor: colors.ink, borderRadius: 26 },
  card: {
    flex: 1,
    backgroundColor: colors.paper,
    borderRadius: 26,
    borderWidth: outline,
    borderColor: colors.ink,
    overflow: 'hidden',
  },
  divider: { height: outline, backgroundColor: colors.ink },
  chip: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.yellow.base,
    borderWidth: 2.5,
    borderColor: colors.ink,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  timeChip: { top: 14, left: 14, transform: [{ rotate: '-3deg' }] },
  chipText: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  body: { flex: 1, padding: 18, gap: 8 },
  title: { fontFamily: fonts.bold, fontSize: 25, lineHeight: 29, color: colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  meta: { fontFamily: fonts.medium, fontSize: 15, color: colors.inkSoft },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  footerText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink, flexShrink: 1 },
  flipHint: { marginLeft: 'auto', fontFamily: fonts.pencil, fontSize: 16, color: colors.inkSoft },
  back: { padding: 20, gap: 12, backgroundColor: colors.paper },
  backTitle: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 26, color: colors.ink },
  desc: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.ink },
  infoBox: {
    gap: 8,
    backgroundColor: colors.cream,
    borderWidth: 2.5,
    borderColor: colors.ink,
    borderRadius: 16,
    padding: 12,
  },
  info: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink, flexShrink: 1 },
  sectionLabel: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.2, color: colors.inkSoft },
  people: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  person: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  personName: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
});

import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { Avatar, AvatarStack } from '../components/Avatar';
import { ChunkyButton } from '../components/ChunkyButton';
import { EventDetailModal } from '../components/EventDetailModal';
import { Screen } from '../components/Screen';
import { TagPill } from '../components/TagPill';
import { TextField } from '../components/TextField';
import { useAppState } from '../hooks/useAppState';
import type { Event, Friend } from '../mocks/types';
import { colors, fonts, line, outline } from '../theme';
import { friendlyTime, isExpired } from '../utils/time';

const NEW_FRIEND_COLORS = [line.orange.base, line.blue.base, line.purple.base, line.red.base, line.green.base];

export function FriendsScreen() {
  const { friends, events, acceptFriend, requestFriend, logOut } = useAppState();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Event | null>(null);

  const accepted = friends.filter((f) => f.status === 'accepted');
  const incoming = friends.filter((f) => f.status === 'incoming');
  const pending = friends.filter((f) => f.status === 'requested');

  // Only Going is visible to friends, never Saved (DESIGN.md).
  const friendPlans = events
    .filter((e) => !isExpired(e.startsAt))
    .map((e) => ({ event: e, who: accepted.filter((f) => e.goingUserIds.includes(f.id)) }))
    .filter((x) => x.who.length > 0)
    .sort((a, b) => a.event.startsAt.localeCompare(b.event.startsAt));

  // Mock "search by contact": just sends a request to whatever was typed.
  const sendRequest = () => {
    const q = query.trim();
    if (!q) return;
    const name = q.replace(/^@/, '').split(/[._@\s-]/)[0] || q;
    requestFriend(`req-${Date.now()}`, name.charAt(0).toUpperCase() + name.slice(1), NEW_FRIEND_COLORS[friends.length % NEW_FRIEND_COLORS.length]);
    setQuery('');
  };

  return (
    <Screen>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Friends</Text>
        <Pressable onPress={logOut} hitSlop={8}>
          <Text style={styles.logout}>Log out</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 120, gap: 22 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* add by contact */}
        <View style={styles.addBox}>
          <TextField placeholder="Find by @handle, phone or email" value={query} onChangeText={setQuery} autoCapitalize="none" onSubmitEditing={sendRequest} />
          <ChunkyButton label="Send request" variant="blue" size="sm" onPress={sendRequest} disabled={!query.trim()} />
        </View>

        {incoming.length > 0 && (
          <Section title="Requests" count={incoming.length}>
            {incoming.map((f) => (
              <Animated.View key={f.id} layout={LinearTransition.duration(250)} style={styles.requestRow}>
                <Avatar name={f.name} color={f.color} size={40} />
                <Text style={styles.name}>{f.name} wants to be friends</Text>
                <Pressable onPress={() => acceptFriend(f.id)} style={styles.acceptBtn}>
                  <Text style={styles.acceptText}>Accept</Text>
                </Pressable>
              </Animated.View>
            ))}
          </Section>
        )}

        <Section title="Friends are going to…">
          {friendPlans.length === 0 ? (
            <Text style={styles.muted}>When friends mark events as Going, they'll show up here.</Text>
          ) : (
            friendPlans.map(({ event, who }, i) => (
              <Animated.View key={event.id} entering={FadeInDown.delay(i * 60).duration(250)}>
                <Pressable onPress={() => setOpen(event)} style={({ pressed }) => [styles.planCard, pressed && { transform: [{ scale: 0.98 }] }]}>
                  <View style={styles.planTop}>
                    <AvatarStack people={who} size={30} />
                    <Text style={styles.planWho} numberOfLines={1}>
                      {who.map((w) => w.name).join(' & ')}
                    </Text>
                  </View>
                  <Text style={styles.planTitle}>{event.title}</Text>
                  <Text style={styles.muted}>
                    {friendlyTime(event.startsAt)} · {event.location}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                    {event.tags.slice(0, 2).map((t) => (
                      <TagPill key={t} tag={t} compact />
                    ))}
                  </View>
                </Pressable>
              </Animated.View>
            ))
          )}
        </Section>

        <Section title="Your crew" count={accepted.length}>
          {accepted.map((f) => (
            <FriendRow key={f.id} friend={f} />
          ))}
          {pending.map((f) => (
            <FriendRow key={f.id} friend={f} />
          ))}
        </Section>
      </ScrollView>
      <EventDetailModal event={open} onClose={() => setOpen(null)} />
    </Screen>
  );
}

function Section({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <Text style={styles.section}>
        {title}
        {count !== undefined ? <Text style={{ color: colors.inkSoft }}>  {count}</Text> : null}
      </Text>
      {children}
    </View>
  );
}

function FriendRow({ friend }: { friend: Friend }) {
  // Contact info only shows for accepted friends (DESIGN.md; enforced by the API later).
  const contact = friend.status === 'accepted' ? Object.values(friend.contacts)[0] : undefined;
  return (
    <View style={styles.friendRow}>
      <Avatar name={friend.name} color={friend.color} size={38} />
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{friend.name}</Text>
        <Text style={styles.muted}>{friend.status === 'requested' ? 'Request sent ⏳' : contact ?? 'No contact shared'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6, marginBottom: 10 },
  title: { fontFamily: fonts.bold, fontSize: 30, color: colors.ink },
  logout: { fontFamily: fonts.pencil, fontSize: 18, color: colors.inkSoft, textDecorationLine: 'underline' },
  addBox: { gap: 10 },
  section: { fontFamily: fonts.bold, fontSize: 19, color: colors.ink },
  muted: { fontFamily: fonts.medium, fontSize: 14, color: colors.inkSoft },
  name: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink, flexShrink: 1 },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.yellow.soft,
    borderWidth: outline,
    borderColor: colors.ink,
    borderRadius: 18,
    padding: 10,
  },
  acceptBtn: {
    marginLeft: 'auto',
    backgroundColor: colors.green.base,
    borderWidth: 2.5,
    borderColor: colors.ink,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  acceptText: { fontFamily: fonts.bold, fontSize: 14, color: colors.white },
  planCard: {
    backgroundColor: colors.paper,
    borderWidth: outline,
    borderColor: colors.ink,
    borderRadius: 20,
    padding: 14,
    gap: 2,
  },
  planTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  planWho: { fontFamily: fonts.semibold, fontSize: 14, color: colors.green.dark, flexShrink: 1 },
  planTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.ink },
  friendRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});

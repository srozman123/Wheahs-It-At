import { useState, type ReactNode } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { ApiError, type Card, type PublicUser } from '../api';
import { Avatar, AvatarStack } from '../components/Avatar';
import { EventDetailModal } from '../components/EventDetailModal';
import { Screen } from '../components/Screen';
import { TagPill } from '../components/TagPill';
import { TextField } from '../components/TextField';
import { useFriends } from '../hooks/useFriends';
import { useFriendsEvents } from '../hooks/useFriendsEvents';
import { useSession } from '../hooks/useSession';
import { useUserSearch } from '../hooks/useUserSearch';
import { colors, fonts, outline } from '../theme';
import { avatarColor } from '../utils/avatarColor';
import { friendlyTime } from '../utils/time';

export function FriendsScreen() {
  const { logOut } = useSession();
  const { friends, incoming, outgoing, accept, decline, unfriend, sendRequest, refresh } = useFriends();
  const plans = useFriendsEvents();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Card | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const search = useUserSearch(query);

  const run = (action: Promise<void>) =>
    action.catch((e) => Alert.alert('Something went wrong', e instanceof ApiError ? e.message : 'Try again in a moment.'));

  const confirmUnfriend = (f: PublicUser) =>
    Alert.alert(`Unfriend ${f.name}?`, 'They will no longer see your contact info.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Unfriend', style: 'destructive', onPress: () => void run(unfriend(f.id)) },
    ]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refresh(), plans.refresh()]);
    setRefreshing(false);
  };

  const relation = (id: string): 'friend' | 'requested' | 'incoming' | 'none' =>
    friends.some((u) => u.id === id) ? 'friend' : outgoing.some((u) => u.id === id) ? 'requested' : incoming.some((u) => u.id === id) ? 'incoming' : 'none';

  return (
    <Screen>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Friends</Text>
        <Pressable onPress={() => void logOut()} hitSlop={8}>
          <Text style={styles.logout}>Log out</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 120, gap: 22 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.addBox}>
          <TextField placeholder="Find people by name" value={query} onChangeText={setQuery} autoCapitalize="none" />
          {search.active ? (
            <View style={{ gap: 8 }}>
              {search.loading ? <Text style={styles.muted}>Searching…</Text> : null}
              {search.error ? <Text style={styles.error}>{search.error}</Text> : null}
              {!search.loading && !search.error && search.results.length === 0 ? <Text style={styles.muted}>No one found.</Text> : null}
              {search.results.map((u) => {
                const rel = relation(u.id);
                return (
                  <View key={u.id} style={styles.friendRow}>
                    <Avatar name={u.name} color={avatarColor(u.id)} size={38} />
                    <Text style={[styles.name, { flex: 1 }]}>{u.name}</Text>
                    <Pressable
                      disabled={rel === 'friend' || rel === 'requested'}
                      onPress={() => void run(rel === 'incoming' ? accept(u.id) : sendRequest(u.id))}
                      style={[styles.pill, (rel === 'friend' || rel === 'requested') && { backgroundColor: colors.sand }]}
                    >
                      <Text style={styles.pillText}>{rel === 'friend' ? 'Friends' : rel === 'requested' ? 'Requested' : rel === 'incoming' ? 'Accept' : '+ Add'}</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          ) : null}
        </View>

        {incoming.length > 0 && (
          <Section title="Requests" count={incoming.length}>
            {incoming.map((f) => (
              <Animated.View key={f.id} layout={LinearTransition.duration(250)} style={styles.requestRow}>
                <Avatar name={f.name} color={avatarColor(f.id)} size={40} />
                <Text style={styles.name}>{f.name}</Text>
                <View style={styles.requestActions}>
                  <Pressable onPress={() => void run(decline(f.id))} style={styles.declineBtn}>
                    <Text style={styles.declineText}>Decline</Text>
                  </Pressable>
                  <Pressable onPress={() => void run(accept(f.id))} style={styles.acceptBtn}>
                    <Text style={styles.acceptText}>Accept</Text>
                  </Pressable>
                </View>
              </Animated.View>
            ))}
          </Section>
        )}

        <Section title="Friends are going to…">
          {plans.error ? <Text style={styles.error}>{plans.error}</Text> : null}
          {!plans.error && plans.events.length === 0 ? (
            <Text style={styles.muted}>{plans.loading ? 'Loading…' : "When friends mark events as Going, they'll show up here."}</Text>
          ) : (
            plans.events.map((event, i) => (
              <Animated.View key={event.id} entering={FadeInDown.delay(i * 60).duration(250)}>
                <Pressable onPress={() => setOpen(event)} style={({ pressed }) => [styles.planCard, pressed && { transform: [{ scale: 0.98 }] }]}>
                  <View style={styles.planTop}>
                    <AvatarStack people={event.goingFriends.map((w) => ({ name: w.name, color: avatarColor(w.id) }))} size={30} />
                    <Text style={styles.planWho} numberOfLines={1}>
                      {event.goingFriends.map((w) => w.name).join(' & ')}
                    </Text>
                  </View>
                  <Text style={styles.planTitle}>{event.title}</Text>
                  <Text style={styles.muted}>
                    {friendlyTime(event.startsAt)}
                    {event.location ? ` · ${event.location}` : ''}
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

        <Section title="Your crew" count={friends.length}>
          {friends.length === 0 && outgoing.length === 0 ? <Text style={styles.muted}>Search above to add your first friend.</Text> : null}
          {friends.map((f) => (
            <FriendRow key={f.id} friend={f} onUnfriend={() => confirmUnfriend(f)} />
          ))}
          {outgoing.map((f) => (
            <FriendRow key={f.id} friend={f} pending />
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

function FriendRow({ friend, pending, onUnfriend }: { friend: PublicUser; pending?: boolean; onUnfriend?: () => void }) {
  // The server only sends contacts for accepted friends.
  const contacts = Object.values(friend.contacts ?? {}).filter(Boolean);
  return (
    <View style={styles.friendRow}>
      <Avatar name={friend.name} color={avatarColor(friend.id)} size={38} />
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{friend.name}</Text>
        <Text style={styles.muted}>{pending ? 'Request sent ⏳' : contacts.length ? contacts.join(' · ') : 'No contact shared'}</Text>
      </View>
      {onUnfriend ? (
        <Pressable onPress={onUnfriend} hitSlop={8}>
          <Text style={styles.logout}>Unfriend</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6, marginBottom: 10 },
  title: { fontFamily: fonts.bold, fontSize: 30, color: colors.ink },
  logout: { fontFamily: fonts.pencil, fontSize: 18, color: colors.inkSoft, textDecorationLine: 'underline' },
  addBox: { gap: 10 },
  error: { fontFamily: fonts.semibold, fontSize: 14, color: colors.red.dark },
  pill: { backgroundColor: colors.blue.soft, borderWidth: 2.5, borderColor: colors.ink, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  pillText: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  requestActions: { marginLeft: 'auto', flexDirection: 'row', gap: 8 },
  declineBtn: { backgroundColor: colors.paper, borderWidth: 2.5, borderColor: colors.ink, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  declineText: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
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

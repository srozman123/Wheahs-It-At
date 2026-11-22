import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  acceptFriendRequest,
  declineFriendRequest,
  getFriendRequests,
  getFriends,
  removeFriend,
  sendFriendRequest,
  type PublicUser,
} from '../api';
import { useLibrary } from './useLibrary';
import { useSession } from './useSession';

type Friends = {
  friends: PublicUser[];
  incoming: PublicUser[];
  outgoing: PublicUser[];
  /** Actions reject with ApiError; callers decide how to show it. */
  sendRequest: (userId: string) => Promise<void>;
  accept: (userId: string) => Promise<void>;
  decline: (userId: string) => Promise<void>;
  unfriend: (userId: string) => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<Friends | null>(null);

export function FriendsProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const userId = user?.id ?? null;
  const [friends, setFriends] = useState<PublicUser[]>([]);
  const [incoming, setIncoming] = useState<PublicUser[]>([]);
  const [outgoing, setOutgoing] = useState<PublicUser[]>([]);

  const { refresh: refreshLibrary } = useLibrary();
  // Bumped per user change and per refresh; older results are dropped.
  const generation = useRef(0);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const mine = ++generation.current;
    try {
      const [f, r] = await Promise.all([getFriends(), getFriendRequests()]);
      if (mine !== generation.current) return;
      setFriends(f);
      setIncoming(r.incoming);
      setOutgoing(r.outgoing);
    } catch {
      // keep what we have; the next refresh will retry
    }
  }, [userId]);

  useEffect(() => {
    generation.current++;
    setFriends([]);
    setIncoming([]);
    setOutgoing([]);
    void refresh();
  }, [refresh]);

  // Each action changes both lists server-side (e.g. sending to someone who asked you accepts), so re-fetch.
  const sendRequest = useCallback(async (id: string) => {
    await sendFriendRequest(id);
    await refresh();
  }, [refresh]);
  const accept = useCallback(async (id: string) => {
    await acceptFriendRequest(id);
    await Promise.all([refresh(), refreshLibrary()]);
  }, [refresh, refreshLibrary]);
  const decline = useCallback(async (id: string) => {
    await declineFriendRequest(id);
    await refresh();
  }, [refresh]);
  const unfriend = useCallback(async (id: string) => {
    await removeFriend(id);
    await Promise.all([refresh(), refreshLibrary()]);
  }, [refresh, refreshLibrary]);

  const value = useMemo(
    () => ({ friends, incoming, outgoing, sendRequest, accept, decline, unfriend, refresh }),
    [friends, incoming, outgoing, sendRequest, accept, decline, unfriend, refresh],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFriends() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useFriends must be used inside <FriendsProvider>');
  return ctx;
}

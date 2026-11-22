import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, getFriendsEvents, type FriendsGoingEvent } from '../api';
import { useSession } from './useSession';

type FriendsEvents = {
  events: FriendsGoingEvent[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

/** Upcoming events friends are going to; reloads whenever the screen regains focus. */
export function useFriendsEvents(): FriendsEvents {
  const { user } = useSession();
  const userId = user?.id ?? null;
  const generation = useRef(0);
  const [events, setEvents] = useState<FriendsGoingEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New user: drop the old user's events and ignore their in-flight request.
  useEffect(() => {
    generation.current++;
    setEvents([]);
    setError(null);
    setLoading(false);
  }, [userId]);

  const refresh = useCallback(async () => {
    const mine = ++generation.current;
    setLoading(true);
    setError(null);
    try {
      const all = await getFriendsEvents();
      if (mine === generation.current) setEvents(all.filter((e) => !e.expired));
    } catch (e) {
      if (mine === generation.current) setError(e instanceof ApiError ? e.message : 'Could not load your friends\' plans.');
    } finally {
      if (mine === generation.current) setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return { events, loading, error, refresh };
}

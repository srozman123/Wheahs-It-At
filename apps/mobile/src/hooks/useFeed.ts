import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, getFeed, type Card } from '../api';
import { useLibrary } from './useLibrary';
import { useSession } from './useSession';

const LOW_WATER = 2;

type Feed = {
  /** Cards still to swipe, top first. */
  deck: Card[];
  /** True while a fetch is in flight. */
  loading: boolean;
  error: string | null;
  /** Clears the "nothing new" stop and fetches more if the deck is running low. */
  refresh: () => Promise<void>;
};

/**
 * The swipe deck, served by GET /feed. Fetches the next batch when 2 or fewer
 * cards remain, excluding everything acted on this session and the deck itself.
 * Once the server returns nothing new it stops until refresh() is called.
 */
export function useFeed(): Feed {
  const { user } = useSession();
  const { actedIds } = useLibrary();
  const userId = user?.id ?? null;
  const [batch, setBatch] = useState<Card[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exhausted, setExhausted] = useState(false);

  const inFlight = useRef(false);
  // Bumped on user change; a fetch that finishes under an older generation is dropped.
  const generation = useRef(0);
  const deck = batch.filter((c) => !actedIds.has(c.id));
  const deckRef = useRef(deck);
  deckRef.current = deck;
  const actedRef = useRef(actedIds);
  actedRef.current = actedIds;

  const fetchMore = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    const mine = generation.current;
    setLoading(true);
    setError(null);
    try {
      const held = new Set(deckRef.current.map((c) => c.id));
      const next = await getFeed([...actedRef.current, ...held]);
      if (mine !== generation.current) return;
      const fresh = next.filter((c) => !held.has(c.id) && !actedRef.current.has(c.id));
      if (fresh.length === 0) setExhausted(true);
      else setBatch([...deckRef.current, ...fresh]);
    } catch (e) {
      if (mine === generation.current) setError(e instanceof ApiError ? e.message : 'Could not load events.');
    } finally {
      if (mine === generation.current) {
        inFlight.current = false;
        setLoading(false);
      }
    }
  }, []);

  // New user (login/logout): start over.
  useEffect(() => {
    generation.current++;
    inFlight.current = false;
    setLoading(false);
    setBatch([]);
    setExhausted(false);
    setError(null);
  }, [userId]);

  // Initial load and top-ups. A failure also pauses this until the user retries.
  useEffect(() => {
    if (userId && !exhausted && !error && deck.length <= LOW_WATER) void fetchMore();
  }, [userId, exhausted, error, deck.length, fetchMore]);

  const refresh = useCallback(async () => {
    setExhausted(false);
    setError(null);
    if (deckRef.current.length <= LOW_WATER) await fetchMore();
  }, [fetchMore]);

  return { deck, loading, error, refresh };
}

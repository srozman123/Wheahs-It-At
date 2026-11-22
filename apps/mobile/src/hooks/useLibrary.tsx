import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ApiError, getGoing, getSaved, postSwipe, type Card, type SwipeAction } from '../api';
import { useSession } from './useSession';

type Library = {
  saved: Card[];
  going: Card[];
  /** Ids of events swiped this session (the feed passes them as `exclude`). */
  actedIds: ReadonlySet<string>;
  /** Message from the last failed swipe, if any. */
  error: string | null;
  clearError: () => void;
  swipe: (card: Card, action: SwipeAction) => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<Library | null>(null);

const without = (list: Card[], id: string) => list.filter((c) => c.id !== id);
const withCard = (list: Card[], card: Card) => [card, ...without(list, card.id)];

export function LibraryProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const userId = user?.id ?? null;
  const [saved, setSavedState] = useState<Card[]>([]);
  const [going, setGoingState] = useState<Card[]>([]);
  const [actedIds, setActedIds] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Refs always hold the latest lists so optimistic updates and reverts use the true prior state.
  const savedRef = useRef<Card[]>([]);
  const goingRef = useRef<Card[]>([]);
  // Bumped on every user change and every refresh; results from older requests are dropped.
  const generation = useRef(0);
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  // Latest swipe per card: a failed older swipe must not undo a newer one.
  const swipeSeq = useRef(0);
  const latestSwipe = useRef(new Map<string, number>());

  const setSaved = useCallback((fn: (l: Card[]) => Card[]) => {
    savedRef.current = fn(savedRef.current);
    setSavedState(savedRef.current);
  }, []);
  const setGoing = useCallback((fn: (l: Card[]) => Card[]) => {
    goingRef.current = fn(goingRef.current);
    setGoingState(goingRef.current);
  }, []);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const mine = ++generation.current;
    try {
      const [s, g] = await Promise.all([getSaved(), getGoing()]);
      if (mine !== generation.current) return;
      setSaved(() => s);
      setGoing(() => g);
    } catch (e) {
      if (mine === generation.current) setError(e instanceof ApiError ? e.message : 'Could not load your events.');
    }
  }, [userId, setSaved, setGoing]);

  useEffect(() => {
    generation.current++;
    setSaved(() => []);
    setGoing(() => []);
    setActedIds(new Set());
    setError(null);
    void refresh();
  }, [refresh, setSaved, setGoing]);

  const swipe = useCallback(
    async (card: Card, action: SwipeAction) => {
      const owner = userIdRef.current;
      const mine = ++swipeSeq.current;
      latestSwipe.current.set(card.id, mine);
      const wasSaved = savedRef.current.some((c) => c.id === card.id);
      const wasGoing = goingRef.current.some((c) => c.id === card.id);

      setSaved((l) => (action === 'save' ? withCard(l, card) : without(l, card.id)));
      setGoing((l) => (action === 'going' ? withCard(l, card) : without(l, card.id)));
      setActedIds((s) => new Set(s).add(card.id));

      try {
        await postSwipe(card.id, action);
      } catch (e) {
        if (owner !== userIdRef.current) return; // user changed; nothing to revert
        setError(e instanceof ApiError ? e.message : 'Could not save that. Try again.');
        if (latestSwipe.current.get(card.id) !== mine) return; // a newer swipe owns this card's state
        setSaved((l) => (wasSaved ? withCard(l, card) : without(l, card.id)));
        setGoing((l) => (wasGoing ? withCard(l, card) : without(l, card.id)));
        setActedIds((s) => {
          const next = new Set(s);
          next.delete(card.id);
          return next;
        });
      }
    },
    [setSaved, setGoing],
  );

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo(
    () => ({ saved, going, actedIds, error, clearError, swipe, refresh }),
    [saved, going, actedIds, error, clearError, swipe, refresh],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLibrary() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useLibrary must be used inside <LibraryProvider>');
  return ctx;
}

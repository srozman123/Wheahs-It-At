import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { MOCK_EVENTS } from '../mocks/events';
import { MOCK_FRIENDS } from '../mocks/friends';
import type { ContactKind, Event, Friend, SwipeAction, User } from '../mocks/types';

/**
 * In-memory app state for the front-end prototype.
 *
 * Every function here is a stand-in for an API call. When the backend is
 * ready, keep this hook's shape and swap the bodies for calls into src/api/ —
 * the screens won't need to change.
 */

type AppState = {
  user: User | null;
  onboarded: boolean;
  events: Event[];
  swipes: Record<string, SwipeAction>;
  friends: Friend[];
};

type AppActions = {
  signUp: (email: string) => void;
  logIn: (email: string) => void;
  logOut: () => void;
  completeOnboarding: (input: { name: string; contactKind: ContactKind; contact: string; interests: string[] }) => void;
  swipe: (eventId: string, action: SwipeAction) => void;
  postEvent: (event: Omit<Event, 'id' | 'creatorId' | 'goingUserIds'>) => void;
  acceptFriend: (friendId: string) => void;
  requestFriend: (userId: string, name: string, color: string) => void;
};

const Ctx = createContext<(AppState & AppActions) | null>(null);

const DEMO_USER: User = {
  id: 'me',
  name: 'Alex',
  contacts: { instagram: '@alex' },
  interests: ['music', 'food', 'comedy', 'outdoors'],
};

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>({
    user: null,
    onboarded: false,
    events: MOCK_EVENTS,
    swipes: {},
    friends: MOCK_FRIENDS,
  });

  const signUp = useCallback((_email: string) => {
    setState((s) => ({ ...s, user: { id: 'me', name: '', contacts: {}, interests: [] }, onboarded: false, swipes: {} }));
  }, []);

  // Logging in drops you into a lived-in account so every tab has something to show.
  const logIn = useCallback((_email: string) => {
    setState((s) => ({
      ...s,
      user: DEMO_USER,
      onboarded: true,
      swipes: { e13: 'save', e2: 'save', e5: 'going' },
    }));
  }, []);

  const logOut = useCallback(() => setState((s) => ({ ...s, user: null, onboarded: false })), []);

  const completeOnboarding: AppActions['completeOnboarding'] = useCallback(({ name, contactKind, contact, interests }) => {
    setState((s) => ({
      ...s,
      onboarded: true,
      user: { id: 'me', name, contacts: { [contactKind]: contact }, interests },
    }));
  }, []);

  const swipe = useCallback((eventId: string, action: SwipeAction) => {
    setState((s) => {
      const events =
        action === 'going'
          ? s.events.map((e) => (e.id === eventId && !e.goingUserIds.includes('me') ? { ...e, goingUserIds: [...e.goingUserIds, 'me'] } : e))
          : s.events.map((e) => (e.id === eventId ? { ...e, goingUserIds: e.goingUserIds.filter((id) => id !== 'me') } : e));
      return {
        ...s,
        events,
        swipes: { ...s.swipes, [eventId]: action },
      };
    });
  }, []);

  const postEvent: AppActions['postEvent'] = useCallback((event) => {
    setState((s) => ({
      ...s,
      events: [{ ...event, id: `mine-${Date.now()}`, creatorId: 'me', goingUserIds: ['me'] }, ...s.events],
    }));
  }, []);

  const acceptFriend = useCallback((friendId: string) => {
    setState((s) => ({ ...s, friends: s.friends.map((f) => (f.id === friendId ? { ...f, status: 'accepted' } : f)) }));
  }, []);

  const requestFriend = useCallback((userId: string, name: string, color: string) => {
    setState((s) =>
      s.friends.some((f) => f.id === userId)
        ? s
        : { ...s, friends: [...s.friends, { id: userId, name, color, status: 'requested', contacts: {} }] },
    );
  }, []);

  const value = useMemo(
    () => ({ ...state, signUp, logIn, logOut, completeOnboarding, swipe, postEvent, acceptFriend, requestFriend }),
    [state, signUp, logIn, logOut, completeOnboarding, swipe, postEvent, acceptFriend, requestFriend],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAppState must be used inside <AppStateProvider>');
  return ctx;
}

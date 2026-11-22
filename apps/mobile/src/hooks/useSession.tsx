import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError, getMe, login, onUnauthorized, setUserId, signup, updateMe, type Me, type MeUpdate } from '../api';

const STORAGE_KEY = 'wheahs.userId';

type Session = {
  user: Me | null;
  /** False until the saved user id (if any) has been checked against the server. */
  hydrated: boolean;
  /** Set when the saved session couldn't be checked (e.g. offline); `hydrated` stays false. */
  hydrateError: string | null;
  retryHydrate: () => Promise<void>;
  /** The server has no onboarding flag: picking interests is what completes it. */
  onboarded: boolean;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  logIn: (email: string, password: string) => Promise<void>;
  logOut: () => Promise<void>;
  updateProfile: (update: MeUpdate) => Promise<void>;
};

const Ctx = createContext<Session | null>(null);

async function saveId(id: string | null) {
  try {
    if (id) await AsyncStorage.setItem(STORAGE_KEY, id);
    else await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage failure only costs us auto-login next launch
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [hydrateError, setHydrateError] = useState<string | null>(null);

  const clear = useCallback(async () => {
    setUserId(null);
    setUser(null);
    await saveId(null);
  }, []);

  const start = useCallback(async (me: Me) => {
    setUserId(me.id);
    setUser(me);
    await saveId(me.id);
  }, []);

  useEffect(() => {
    onUnauthorized(() => void clear());
    return () => onUnauthorized(null);
  }, [clear]);

  // Checks the saved id against the server. Only a 401 forgets it; a network failure
  // keeps the id and reports hydrateError so the app can offer a retry.
  const hydrate = useCallback(async () => {
    setHydrateError(null);
    try {
      const id = await AsyncStorage.getItem(STORAGE_KEY);
      if (id) {
        setUserId(id);
        setUser(await getMe());
      }
      setHydrated(true);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await clear();
        setHydrated(true);
      } else {
        setHydrateError(e instanceof ApiError ? e.message : 'Could not reach the server.');
      }
    }
  }, [clear]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const signUp = useCallback(async (name: string, email: string, password: string) => start(await signup(name, email, password)), [start]);
  const logIn = useCallback(async (email: string, password: string) => start(await login(email, password)), [start]);
  const updateProfile = useCallback(async (update: MeUpdate) => setUser(await updateMe(update)), []);

  const value = useMemo<Session>(
    () => ({ user, hydrated, hydrateError, retryHydrate: hydrate, onboarded: (user?.interests.length ?? 0) > 0, signUp, logIn, logOut: clear, updateProfile }),
    [user, hydrated, hydrateError, hydrate, signUp, logIn, clear, updateProfile],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}

import { useEffect, useState } from 'react';
import { ApiError, searchUsers, type PublicUser } from '../api';

const DEBOUNCE_MS = 300;
const MIN_LENGTH = 2;

type UserSearch = {
  /** True once the query is long enough to search. */
  active: boolean;
  results: PublicUser[];
  loading: boolean;
  error: string | null;
};

/** Debounced user search (GET /users/search) for a text query. */
export function useUserSearch(query: string): UserSearch {
  const q = query.trim();
  const active = q.length >= MIN_LENGTH;
  const [results, setResults] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    if (!active) {
      setResults([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      searchUsers(q)
        .then((users) => !cancelled && setResults(users))
        .catch((e) => {
          if (cancelled) return;
          setResults([]);
          setError(e instanceof ApiError ? e.message : 'Search failed. Try again.');
        })
        .finally(() => !cancelled && setLoading(false));
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q, active]);

  return { active, results, loading, error };
}

import { useCallback, useRef, useState } from 'react';
import { ApiError, createEvent, type NewEvent } from '../api';
import { useLibrary } from './useLibrary';

export type PostInput = {
  title: string;
  description: string;
  tags: string[];
  startsAt: Date;
  location: string;
  /** Free, or a price in dollars (blank = unknown). */
  free: boolean;
  price: string;
};

type PostEvent = {
  /** Resolves true on success. Failure sets `error`. */
  post: (input: PostInput) => Promise<boolean>;
  posting: boolean;
  error: string | null;
  clearError: () => void;
};

const MAX_PRICE = 999_999.99;

/** "$5" / "5.50" → number; blank → null; anything else → NaN. */
function parsePrice(raw: string): number | null {
  const cleaned = raw.replace(/[$\s]/g, '');
  if (!cleaned) return null;
  const n = /^\d*\.?\d+$|^\d+\.$/.test(cleaned) ? Number(cleaned) : NaN;
  return n;
}

function priceProblem(i: PostInput): string | null {
  if (i.free) return null;
  const price = parsePrice(i.price);
  if (price === null) return null;
  return Number.isFinite(price) && price >= 0 && price <= MAX_PRICE ? null : 'Enter a price like 5 or 12.50, or leave it blank.';
}

function toNewEvent(i: PostInput): NewEvent {
  const event: NewEvent = { title: i.title.trim(), tags: i.tags, startsAt: i.startsAt.toISOString() };
  const description = i.description.trim();
  const location = i.location.trim();
  if (description) event.description = description;
  if (location) event.location = location;
  if (i.free) {
    event.priceMin = 0;
    event.priceMax = 0;
  } else {
    const price = parsePrice(i.price);
    if (price !== null) {
      event.priceMin = price;
      event.priceMax = price;
    }
  }
  return event;
}

/** Creates an event, then refreshes the library (the creator is automatically Going). */
export function usePostEvent(): PostEvent {
  const { refresh } = useLibrary();
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  const post = useCallback(
    async (input: PostInput) => {
      if (busy.current) return false;
      const priceError = priceProblem(input);
      if (priceError) {
        setError(priceError);
        return false;
      }
      if (input.startsAt.getTime() <= Date.now()) {
        setError('That start time has already passed. Pick a later time.');
        return false;
      }
      busy.current = true;
      setPosting(true);
      setError(null);
      try {
        await createEvent(toNewEvent(input));
        await refresh();
        return true;
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Could not post. Try again.');
        return false;
      } finally {
        busy.current = false;
        setPosting(false);
      }
    },
    [refresh],
  );

  const clearError = useCallback(() => setError(null), []);

  return { post, posting, error, clearError };
}

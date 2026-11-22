import { useEffect, useMemo, useRef, useState } from 'react';
import { FEED_CONFIG } from '../mocks/feedConfig';
import type { Event, SwipeAction } from '../mocks/types';
import { isThisWeek } from '../utils/time';
import { useAppState } from './useAppState';

/**
 * Builds the card deck in batches, as described in DESIGN.md → "Building the feed".
 * Locally ranked for now; later the batch comes from the server's /feed endpoint.
 */
export function useFeed() {
  const { events, swipes, user, friends } = useAppState();
  const [batch, setBatch] = useState<string[]>([]);
  const swipesRef = useRef(swipes);
  swipesRef.current = swipes;

  const friendIds = useMemo(
    () => new Set(friends.filter((f) => f.status === 'accepted').map((f) => f.id)),
    [friends],
  );

  const buildBatch = () => {
    const acted = swipesRef.current;
    const candidates = events.filter((e) => !(e.id in acted) && isThisWeek(e.startsAt));

    // Tag scores are calculated from onboarding interests + past swipes, never stored.
    const tagScore: Record<string, number> = {};
    for (const t of user?.interests ?? []) tagScore[t] = (tagScore[t] ?? 0) + FEED_CONFIG.weights.onboarding;
    for (const [eventId, action] of Object.entries(acted)) {
      const ev = events.find((e) => e.id === eventId);
      ev?.tags.forEach((t) => (tagScore[t] = (tagScore[t] ?? 0) + FEED_CONFIG.weights[action as SwipeAction]));
    }

    const now = Date.now();
    const score = (e: Event) => {
      const interest = e.tags.reduce((sum, t) => sum + (tagScore[t] ?? 0), 0);
      const friendBoost = e.goingUserIds.filter((id) => friendIds.has(id)).length * FEED_CONFIG.friendGoingBoost;
      const daysAway = (new Date(e.startsAt).getTime() - now) / 86_400_000;
      const soonness = FEED_CONFIG.soonnessWeight * Math.max(0, 7 - daysAway) / 7;
      return interest + friendBoost + soonness + Math.random() * FEED_CONFIG.randomness;
    };

    const ranked = [...candidates].sort((a, b) => score(b) - score(a));
    // Every Nth card is a random wildcard for exploration.
    for (let i = FEED_CONFIG.wildcardEvery - 1; i < ranked.length; i += FEED_CONFIG.wildcardEvery) {
      const j = i + Math.floor(Math.random() * (ranked.length - i));
      [ranked[i], ranked[j]] = [ranked[j], ranked[i]];
    }
    return ranked.slice(0, FEED_CONFIG.batchSize).map((e) => e.id);
  };

  // Cards still to swipe in the current batch.
  const remaining = batch.filter((id) => !(id in swipes));

  // Fetch the next batch when we're near the end (also covers first load and newly posted events).
  useEffect(() => {
    if (remaining.length <= 2) {
      const next = buildBatch().filter((id) => !remaining.includes(id));
      if (next.length > 0) setBatch([...remaining, ...next]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining.length, events.length]);

  const deck = remaining
    .map((id) => events.find((e) => e.id === id))
    .filter((e): e is Event => Boolean(e));

  return { deck };
}

/**
 * TEMPORARY copy of FEED_CONFIG from docs/DESIGN.md. In the real app the
 * server ranks the feed; this only exists so the prototype deck feels personal.
 */
export const FEED_CONFIG = {
  weights: { onboarding: 2, pass: -1, save: 1, going: 3, removed: 0 },
  friendGoingBoost: 2,
  soonnessWeight: 1,
  randomness: 0.5,
  wildcardEvery: 5,
  batchSize: 20,
};

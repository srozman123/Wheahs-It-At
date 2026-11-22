import { listFeedCandidates, type Card } from "../db/events.js";
import { listSwipedTags, type SwipedTags } from "../db/swipes.js";
import { getPool } from "../db/pool.js";
import { findMeById } from "../db/users.js";
import { FEED_CONFIG } from "../feedConfig.js";

type FeedConfig = typeof FEED_CONFIG;
export type TagScores = ReadonlyMap<string, number>;

const MS_PER_HOUR = 3_600_000;
// Matches the 7-day candidate window in db/events.ts.
const WINDOW_HOURS = 168;

export function computeTagScores(
  interests: readonly string[],
  swipes: readonly SwipedTags[],
  weights: FeedConfig["weights"],
): TagScores {
  const scores = new Map<string, number>();
  const add = (tag: string, amount: number) => scores.set(tag, (scores.get(tag) ?? 0) + amount);

  for (const tag of interests) {
    add(tag, weights.onboarding);
  }
  for (const swipe of swipes) {
    for (const tag of swipe.tags) {
      add(tag, weights[swipe.action]);
    }
  }
  return scores;
}

function scoreCard(card: Card, tagScores: TagScores, config: FeedConfig, now: Date, rng: () => number): number {
  const tagScore = card.tags.reduce((sum, tag) => sum + (tagScores.get(tag) ?? 0), 0);
  const hoursUntilStart = (Date.parse(card.startsAt) - now.getTime()) / MS_PER_HOUR;
  const soonness = config.soonnessWeight * (1 - hoursUntilStart / WINDOW_HOURS);
  return tagScore + config.friendGoingBoost * card.friendsGoing + soonness + rng() * config.randomness;
}

// Best-scoring cards first, except every wildcardEvery-th slot, which is a random remaining card.
export function rankFeed(
  candidates: readonly Card[],
  tagScores: TagScores,
  config: FeedConfig,
  now: Date,
  rng: () => number,
): Card[] {
  const remaining = candidates
    .map((card) => ({ card, score: scoreCard(card, tagScores, config, now, rng) }))
    .sort((a, b) => b.score - a.score);

  const batch: Card[] = [];
  const size = Math.min(config.batchSize, remaining.length);
  for (let slot = 1; slot <= size; slot++) {
    const isWildcard = slot % config.wildcardEvery === 0;
    const index = isWildcard ? Math.floor(rng() * remaining.length) : 0;
    batch.push(remaining.splice(index, 1)[0].card);
  }
  return batch;
}

export async function getFeed(userId: string, excludeIds: string[]): Promise<Card[]> {
  const [me, swipes, candidates] = await Promise.all([
    findMeById(userId),
    listSwipedTags(getPool(), userId),
    listFeedCandidates(userId, excludeIds),
  ]);
  const tagScores = computeTagScores(me?.interests ?? [], swipes, FEED_CONFIG.weights);
  return rankFeed(candidates, tagScores, FEED_CONFIG, new Date(), Math.random);
}

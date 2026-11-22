import { describe, expect, it } from "vitest";
import type { Card } from "../src/db/events.js";
import { FEED_CONFIG } from "../src/feedConfig.js";
import { computeTagScores, rankFeed } from "../src/services/feed.js";

const NOW = new Date("2026-11-21T12:00:00Z");
const HOUR = 3_600_000;

function card(id: string, overrides: Partial<Card> = {}): Card {
  return {
    id,
    title: id,
    description: null,
    tags: [],
    startsAt: new Date(NOW.getTime() + 24 * HOUR).toISOString(),
    location: null,
    lat: null,
    lng: null,
    imageUrl: null,
    sourceUrl: null,
    priceMin: null,
    priceMax: null,
    creatorId: null,
    friendsGoing: 0,
    expired: false,
    ...overrides,
  };
}

// Deterministic PRNG (mulberry32), so "random" runs are reproducible.
function seededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const zeroRng = () => 0;
// No randomness and no wildcards: pure score order.
const NO_RANDOM = { ...FEED_CONFIG, randomness: 0, wildcardEvery: 1000 };
const ids = (cards: Card[]) => cards.map((c) => c.id);

describe("computeTagScores", () => {
  it("adds onboarding weight per interest and the action weight per swiped tag", () => {
    const scores = computeTagScores(
      ["music", "food"],
      [
        { action: "going", tags: ["music", "nightlife"] },
        { action: "save", tags: ["food"] },
        { action: "pass", tags: ["sports", "music"] },
        { action: "removed", tags: ["art"] },
      ],
      FEED_CONFIG.weights,
    );
    const w = FEED_CONFIG.weights;
    expect(scores.get("music")).toBe(w.onboarding + w.going + w.pass);
    expect(scores.get("food")).toBe(w.onboarding + w.save);
    expect(scores.get("nightlife")).toBe(w.going);
    expect(scores.get("sports")).toBe(w.pass);
    expect(scores.get("art") ?? 0).toBe(w.removed);
    expect(scores.has("tech")).toBe(false);
  });

  it("empty inputs -> empty scores", () => {
    expect(computeTagScores([], [], FEED_CONFIG.weights).size).toBe(0);
  });
});

describe("rankFeed", () => {
  it("orders by summed tag score", () => {
    const tagScores = new Map([["music", 3], ["food", 1], ["sports", -1]]);
    const candidates = [
      card("sports", { tags: ["sports"] }),
      card("food", { tags: ["food"] }),
      card("music+food", { tags: ["music", "food"] }),
      card("music", { tags: ["music"] }),
    ];
    expect(ids(rankFeed(candidates, tagScores, NO_RANDOM, NOW, zeroRng))).toEqual(["music+food", "music", "food", "sports"]);
  });

  it("friendGoingBoost: more friends going ranks higher", () => {
    const candidates = [card("none"), card("two", { friendsGoing: 2 }), card("one", { friendsGoing: 1 })];
    expect(ids(rankFeed(candidates, new Map(), NO_RANDOM, NOW, zeroRng))).toEqual(["two", "one", "none"]);
  });

  it("soonness: sooner events rank higher when all else is equal", () => {
    const at = (hours: number) => new Date(NOW.getTime() + hours * HOUR).toISOString();
    const candidates = [card("6d", { startsAt: at(144) }), card("1h", { startsAt: at(1) }), card("2d", { startsAt: at(48) })];
    expect(ids(rankFeed(candidates, new Map(), NO_RANDOM, NOW, zeroRng))).toEqual(["1h", "2d", "6d"]);
  });

  it("randomness never outweighs a 1-point tag difference (randomness < 1)", () => {
    expect(FEED_CONFIG.randomness).toBeLessThan(1);
    const config = { ...FEED_CONFIG, wildcardEvery: 1000 };
    const tagScores = new Map([["music", 1]]);
    for (let seed = 1; seed <= 50; seed++) {
      const ranked = rankFeed([card("plain"), card("music", { tags: ["music"] })], tagScores, config, NOW, seededRng(seed));
      expect(ids(ranked)).toEqual(["music", "plain"]);
    }
  });

  it("every wildcardEvery-th slot takes a random remaining card, other slots the best", () => {
    const config = { ...NO_RANDOM, wildcardEvery: 3, batchSize: 6 };
    const candidates = Array.from({ length: 10 }, (_, i) => card(`c${i}`, { friendsGoing: 10 - i })); // c0 best
    // Scoring draws one rng value per candidate; the wildcard draws after that pick the LAST remaining card.
    let calls = 0;
    const rng = () => (calls++ < candidates.length ? 0 : 0.999);
    expect(ids(rankFeed(candidates, new Map(), config, NOW, rng))).toEqual(["c0", "c1", "c9", "c2", "c3", "c8"]);
  });

  it("caps the batch at batchSize with no duplicates", () => {
    const candidates = Array.from({ length: 30 }, (_, i) => card(`c${i}`, { tags: i % 2 ? ["music"] : [] }));
    const batch = rankFeed(candidates, new Map([["music", 1]]), FEED_CONFIG, NOW, seededRng(42));
    expect(batch).toHaveLength(FEED_CONFIG.batchSize);
    expect(new Set(ids(batch)).size).toBe(FEED_CONFIG.batchSize);
  });

  it("fewer candidates than batchSize -> returns all of them", () => {
    const candidates = Array.from({ length: 7 }, (_, i) => card(`c${i}`));
    const batch = rankFeed(candidates, new Map(), FEED_CONFIG, NOW, seededRng(7));
    expect(ids(batch).sort()).toEqual(ids(candidates).sort());
    expect(rankFeed([], new Map(), FEED_CONFIG, NOW, seededRng(7))).toEqual([]);
  });

  it("is deterministic for a given seed and does not mutate its input", () => {
    const candidates = Array.from({ length: 25 }, (_, i) => card(`c${i}`, { friendsGoing: i % 3 }));
    const snapshot = ids(candidates);
    const first = ids(rankFeed(candidates, new Map(), FEED_CONFIG, NOW, seededRng(123)));
    const second = ids(rankFeed(candidates, new Map(), FEED_CONFIG, NOW, seededRng(123)));
    expect(first).toEqual(second);
    expect(ids(candidates)).toEqual(snapshot);
  });

  it("does not leak scores onto the returned cards", () => {
    const [ranked] = rankFeed([card("a")], new Map(), FEED_CONFIG, NOW, zeroRng);
    expect(ranked).toEqual(card("a"));
  });
});

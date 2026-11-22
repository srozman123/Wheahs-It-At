import { DEDUPE, TIMEZONE } from "./config.js";
import { isDateOnlyStart } from "./time.js";
import type { SourceEvent } from "./types.js";

const MAX_START_GAP_MS = 2 * 60 * 60 * 1000;

// Title similarity: Dice coefficient over token sets (2|A∩B| / (|A|+|B|)) after lowercasing,
// stripping accents/punctuation and dropping stopwords. Order-insensitive, so "Jazz Night at
// Cafe X" matches "Cafe X Jazz Night".

const SOURCE_PRIORITY = ["thebostoncalendar", "eventbrite", "do617", "harvard", "mit", "northeastern", "bu", "meetup"];
const STOPWORDS = new Set(["the", "a", "an", "at", "with", "presents", "present", "and", "of", "in", "on", "for", "to"]);

const dayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const nyDay = (iso: string) => dayFormat.format(new Date(iso));

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleTokens(title: string): Set<string> {
  const tokens = normalize(title).split(" ").filter((t) => t && !STOPWORDS.has(t));
  return new Set(tokens.length ? tokens : normalize(title).split(" "));
}

export function titleSimilarity(a: string, b: string): number {
  const ta = titleTokens(a);
  const tb = titleTokens(b);
  let shared = 0;
  for (const token of ta) if (tb.has(token)) shared++;
  return (2 * shared) / (ta.size + tb.size);
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lng2 - lng1) * rad) / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function hasCoords(e: SourceEvent): e is SourceEvent & { lat: number; lng: number } {
  return e.lat !== null && e.lng !== null;
}

function venueText(e: SourceEvent): string | null {
  const text = normalize(e.location ?? e.address ?? "");
  return text || null;
}

function sameVenue(a: SourceEvent, b: SourceEvent): boolean {
  const bothCoords = hasCoords(a) && hasCoords(b);
  if (bothCoords && haversineMeters(a.lat, a.lng, b.lat, b.lng) <= DEDUPE.nearbyMeters) return true;
  const va = venueText(a);
  const vb = venueText(b);
  // Missing venue text doesn't block a match, unless coordinates already prove the venues are far apart.
  if (va === null || vb === null) return !bothCoords;
  return va === vb || va.includes(vb) || vb.includes(va);
}

/** Start times within 2h; a date-only start (no real time known) matches anything the same day (buckets are per day). */
function startsClose(a: SourceEvent, b: SourceEvent): boolean {
  if (isDateOnlyStart(a.startsAt) || isDateOnlyStart(b.startsAt)) return true;
  return Math.abs(new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()) <= MAX_START_GAP_MS;
}

function isSameEvent(a: SourceEvent, b: SourceEvent): boolean {
  if (!startsClose(a, b) || titleSimilarity(a.title, b.title) < DEDUPE.titleSimilarity) return false;
  // Same listing URL and start is enough (venue text can differ); otherwise the venues must match too.
  if (a.sourceUrl === b.sourceUrl && new Date(a.startsAt).getTime() === new Date(b.startsAt).getTime()) return true;
  return sameVenue(a, b);
}

function priority(e: SourceEvent): number {
  const i = SOURCE_PRIORITY.indexOf(e.source);
  return i < 0 ? SOURCE_PRIORITY.length : i;
}

function mergeGroup(group: SourceEvent[]): SourceEvent {
  // Base record by source priority alone (then URL), so the winner (and the event id derived from it) doesn't
  // change when another source's copy gets richer. Missing fields are back-filled from the others.
  const ranked = [...group].sort((a, b) => priority(a) - priority(b) || a.sourceUrl.localeCompare(b.sourceUrl) || a.startsAt.localeCompare(b.startsAt));
  const merged: SourceEvent = { ...ranked[0], hints: [...ranked[0].hints] };
  for (const other of ranked.slice(1)) {
    merged.description ??= other.description;
    merged.imageUrl ??= other.imageUrl;
    merged.address ??= other.address;
    merged.location ??= other.location;
    if (!hasCoords(merged) && hasCoords(other)) {
      merged.lat = other.lat;
      merged.lng = other.lng;
    }
    if (merged.priceMin === null && merged.priceMax === null) {
      merged.priceMin = other.priceMin;
      merged.priceMax = other.priceMax;
    }
    for (const hint of other.hints) if (!merged.hints.includes(hint)) merged.hints.push(hint);
  }
  return merged;
}

/** Groups events that are the same (transitively) within one same-day bucket. */
function groupBucket(bucket: SourceEvent[]): SourceEvent[][] {
  const parent = bucket.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < bucket.length; i++) {
    for (let j = i + 1; j < bucket.length; j++) {
      if (find(i) !== find(j) && isSameEvent(bucket[i], bucket[j])) parent[find(j)] = find(i);
    }
  }
  const groups = new Map<number, SourceEvent[]>();
  bucket.forEach((event, i) => {
    const group = groups.get(find(i));
    if (group) group.push(event);
    else groups.set(find(i), [event]);
  });
  return [...groups.values()];
}

export function dedupeEvents(events: SourceEvent[]): SourceEvent[] {
  const byDay = new Map<string, SourceEvent[]>();
  for (const event of events) {
    const day = nyDay(event.startsAt);
    const bucket = byDay.get(day);
    if (bucket) bucket.push(event);
    else byDay.set(day, [event]);
  }
  const result = [...byDay.values()].flatMap((bucket) => groupBucket(bucket).map(mergeGroup));
  return result.sort(
    (a, b) =>
      new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime() ||
      a.title.localeCompare(b.title) ||
      a.sourceUrl.localeCompare(b.sourceUrl),
  );
}

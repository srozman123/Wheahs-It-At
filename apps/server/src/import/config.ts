import { fileURLToPath } from "node:url";

// Every tunable value for the importer lives here.

const dataDir = (name: string) => fileURLToPath(new URL(`../../data/${name}`, import.meta.url));

export const PATHS = {
  dataDir: dataDir(""),
  /** Written by tools/parse_bostoncalendar.py from a Safari "Page Source" save. */
  bostonCalendar: dataDir("bostoncalendar_events.json"),
  raw: dataDir("events_raw.json"), // stage 1 output
  tags: dataDir("events_tags.json"), // stage 2 output
  httpCache: dataDir("cache/http"),
  geocodeCache: dataDir("cache/geocode.json"),
} as const;

export const TIMEZONE = "America/New_York";

/** Keep events starting from now until this many days ahead. */
export const WINDOW_DAYS = 7;

/**
 * Sources that give only a date use this local (NY) time: noon, so today's all-day events aren't dropped
 * as already started and don't show as 12am. Also marks them as date-only for dedupe.
 */
export const DATE_ONLY_TIME = "12:00";

export const HTTP = {
  // Normal browser UA, as the sources expect (see docs/PROMPT_event_import.md).
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  timeoutMs: 20_000,
  /** Minimum gap between requests to the same host. */
  perHostDelayMs: 1_000,
  /** Reuse cached responses younger than this (keeps re-runs polite). */
  cacheTtlMs: 3 * 60 * 60 * 1000,
  respectRobotsTxt: true,
  /** Hosts that block scripts (403): never fetch their pages or probe their image URLs. */
  noFetchHosts: ["thebostoncalendar.com", "www.thebostoncalendar.com"] as readonly string[],
} as const;

export const GEOCODE = {
  url: "https://nominatim.openstreetmap.org/search",
  // Nominatim's policy asks for an app-identifying UA, not a browser one.
  userAgent: "WheahsItAt-EventImporter/0.1",
  delayMs: 1_100, // max 1 request/second
  /** Results outside this box are rejected as wrong matches. */
  /** City appended to venue text for geocoding, per source (default "Boston, MA"). */
  defaultCity: "Boston, MA",
  sourceCity: { harvard: "Cambridge, MA", mit: "Cambridge, MA" } as Readonly<Record<string, string>>,
  bostonBox: { minLat: 42.0, maxLat: 42.75, minLng: -71.6, maxLng: -70.6 },
} as const;

export const SOURCES = {
  /** Source names to run. Meetup is optional per the spec, so it's off by default. */
  enabled: ["thebostoncalendar", "eventbrite", "do617", "northeastern", "mit", "harvard", "bu"],
  eventbritePages: 3,
  /** BU needs one request per event; cap the detail fetches (spread evenly across days). */
  buMaxDetails: 80,
} as const;

/** Listings that aren't events (validate.ts drops them before tagging). */
export const NON_EVENT = {
  /** Titles that are only a placeholder. */
  placeholderTitle: /^(tba|tbd|tbc|to be announced|to be determined|canceled|cancelled)\.?$/i,
  /** Phrases that mark a notice, deadline or closure rather than something to attend. */
  titlePhrases:
    /\b(recess|no (?:class|classes|seminar|meeting|lecture)s?|call for (?:proposals|submissions|papers|entries|nominations)|deadline|(?:office|offices|university|campus) closed|closure)\b/i,
} as const;

export const DEDUPE = {
  /** Title similarity (0..1) at or above which two same-day events are the same. */
  titleSimilarity: 0.8,
  /** Venues closer than this are "nearby". */
  nearbyMeters: 300,
} as const;

export const LLM = {
  model: "claude-haiku-5-5",
  batchSize: 50,
  maxTokens: 16_000,
} as const;

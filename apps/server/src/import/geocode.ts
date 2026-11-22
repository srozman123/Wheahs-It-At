import { readFile } from "node:fs/promises";
import { GEOCODE, PATHS } from "./config.js";
import { writeJson } from "./io.js";
import type { Logger, SourceEvent } from "./types.js";

type Point = { lat: number; lng: number };
/** Where an unbounded US lookup landed: its state plus the city/town names, for a sanity check. */
export type Place = { state: string | null; names: string[] };
type CacheEntry = Point | Place | null;

export type Geocoder = {
  geocode(query: string): Promise<Point | null>;
  /** Unbounded US lookup (no Boston box): which state the text maps to, or null if nothing found. */
  locate(query: string): Promise<Place | null>;
  save(): Promise<void>;
};

type Options = {
  cachePath?: string;
  fetchFn?: typeof fetch;
  log?: Logger;
  sleep?: (ms: number) => Promise<void>;
};

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const normalizeQuery = (query: string) => query.toLowerCase().replace(/\s+/g, " ").trim();

function inBostonBox({ lat, lng }: Point): boolean {
  const box = GEOCODE.bostonBox;
  return lat >= box.minLat && lat <= box.maxLat && lng >= box.minLng && lng <= box.maxLng;
}

async function loadCache(path: string): Promise<Map<string, CacheEntry>> {
  try {
    const data = JSON.parse(await readFile(path, "utf8")) as Record<string, CacheEntry>;
    return new Map(Object.entries(data));
  } catch {
    return new Map(); // missing or unreadable cache: start fresh
  }
}

export function createGeocoder(opts: Options = {}): Geocoder {
  const cachePath = opts.cachePath ?? PATHS.geocodeCache;
  const fetchFn = opts.fetchFn ?? fetch;
  const log = opts.log ?? (() => {});
  const sleep = opts.sleep ?? realSleep;

  let cache: Promise<Map<string, CacheEntry>> | undefined;
  let lastRequestAt = 0;
  let dirty = false;
  let queue: Promise<unknown> = Promise.resolve();

  const getCache = () => (cache ??= loadCache(cachePath));

  type NominatimResult = { lat?: string; lon?: string; address?: Record<string, string> };

  /** One rate-limited Nominatim request. Returns null on network/HTTP errors (not cacheable). */
  async function request(params: Record<string, string>, query: string): Promise<NominatimResult[] | null> {
    const wait = lastRequestAt + GEOCODE.delayMs - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
    const search = new URLSearchParams({ q: query, format: "jsonv2", limit: "1", countrycodes: "us", ...params });
    try {
      const response = await fetchFn(`${GEOCODE.url}?${search}`, {
        headers: { "user-agent": GEOCODE.userAgent },
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return (await response.json()) as NominatimResult[];
    } catch (error) {
      log(`geocode failed for "${query}": ${(error as Error).message}`);
      return null;
    }
  }

  async function lookup(query: string): Promise<{ point: Point | null; cacheable: boolean }> {
    const box = GEOCODE.bostonBox;
    const results = await request({ viewbox: `${box.minLng},${box.maxLat},${box.maxLng},${box.minLat}`, bounded: "1" }, query);
    if (results === null) return { point: null, cacheable: false };
    {
      const first = results[0];
      const point = first ? { lat: Number(first.lat), lng: Number(first.lon) } : null;
      if (point && (!Number.isFinite(point.lat) || !Number.isFinite(point.lng) || !inBostonBox(point))) {
        return { point: null, cacheable: true };
      }
      return { point, cacheable: true };
    }
  }

  async function locateUncached(query: string): Promise<{ place: Place | null; cacheable: boolean }> {
    const results = await request({ addressdetails: "1" }, query);
    if (results === null) return { place: null, cacheable: false };
    const address = results[0]?.address;
    if (!address) return { place: null, cacheable: true };
    const names = ["city", "town", "village", "hamlet", "county", "state"].map((k) => address[k]).filter((v): v is string => !!v);
    return { place: { state: address.state ?? null, names }, cacheable: true };
  }

  /** Cached lookup; `kind` keeps bounded points and unbounded places in separate keys. */
  async function cached<T extends CacheEntry>(
    kind: "point" | "place",
    query: string,
    fetchOne: (q: string) => Promise<{ value: T; cacheable: boolean }>,
  ): Promise<T | null> {
    const base = normalizeQuery(query);
    if (!base) return null;
    const key = kind === "point" ? base : `place:${base}`;
    const store = await getCache();
    if (store.has(key)) return (store.get(key) as T) ?? null;
    const { value, cacheable } = await fetchOne(query);
    if (cacheable) {
      store.set(key, value);
      dirty = true;
    }
    return value;
  }

  // Serialized so concurrent callers still respect the 1 request/delay rule.
  function serialize<T>(task: () => Promise<T>): Promise<T> {
    const run = queue.then(task);
    queue = run.catch(() => undefined);
    return run;
  }

  return {
    geocode(query) {
      return serialize(() => cached("point", query, async (q) => {
        const { point, cacheable } = await lookup(q);
        return { value: point, cacheable };
      }));
    },
    locate(query) {
      return serialize(() => cached("place", query, async (q) => {
        const { place, cacheable } = await locateUncached(q);
        return { value: place, cacheable };
      }));
    },
    async save() {
      if (!dirty) return;
      await writeJson(cachePath, Object.fromEntries(await getCache()));
      dirty = false;
    },
  };
}

const GENERIC_PLACE = /^(tba|tbd|tbc|boston|cambridge|boston,? ma|various( locations?)?|multiple locations?|see website|n\/a)$/i;
const HAS_REGION = /\b(ma|massachusetts)\b|\bmass\b(?!\.?\s*ave)|\b(boston|cambridge|somerville|brookline|medford|newton|watertown|quincy|allston|brighton)\b|\b\d{5}(-\d{4})?\b/i;

function withCity(place: string, city: string): string {
  return HAS_REGION.test(place) ? place : `${place}, ${city}`;
}

/** Queries to try in order: address (or location) + city, then location + city. */
function geocodeQueries(event: SourceEvent): string[] {
  const city = GEOCODE.sourceCity[event.source] ?? GEOCODE.defaultCity;
  const queries: string[] = [];
  for (const place of [event.address, event.location]) {
    const text = place?.trim();
    if (!text || GENERIC_PLACE.test(text)) continue;
    const query = withCity(text, city);
    if (!queries.includes(query)) queries.push(query);
  }
  return queries;
}

export async function fillCoordinates(events: SourceEvent[], geocoder: Geocoder, log: Logger = () => {}): Promise<SourceEvent[]> {
  const result: SourceEvent[] = [];
  for (const event of events) {
    const queries = event.lat === null || event.lng === null ? geocodeQueries(event) : [];
    let point: Point | null = null;
    for (const query of queries) {
      point = await geocoder.geocode(query);
      if (point) break;
      log(`no coordinates for "${query}"`);
    }
    result.push(point ? { ...event, lat: point.lat, lng: point.lng } : { ...event });
  }
  return result;
}

/**
 * Drops events whose venue maps to another state (e.g. "Sheraton Grand Chicago").
 * Only checks events that still have no coordinates, and only drops when the matched city/state name
 * actually appears in the location text, so a vague room name matching some random US place is kept.
 */
export async function dropOutOfState(
  events: SourceEvent[],
  geocoder: Geocoder,
  log: Logger = () => {},
): Promise<{ kept: SourceEvent[]; dropped: SourceEvent[] }> {
  const kept: SourceEvent[] = [];
  const dropped: SourceEvent[] = [];
  for (const event of events) {
    const text = event.location?.trim();
    if (event.lat !== null || !text || GENERIC_PLACE.test(text) || HAS_REGION.test(text)) {
      kept.push(event);
      continue;
    }
    const place = await geocoder.locate(text);
    const lower = text.toLowerCase();
    const named = place?.names.some((name) => lower.includes(name.toLowerCase())) ?? false;
    if (place?.state && place.state !== "Massachusetts" && named) {
      log(`dropped "${event.title}": "${text}" is in ${place.state}`);
      dropped.push(event);
    } else {
      kept.push(event);
    }
  }
  return { kept, dropped };
}

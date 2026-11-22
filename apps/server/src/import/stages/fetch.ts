import { PATHS, SOURCES } from "../config.js";
import { dedupeEvents } from "../dedupe.js";
import { createGeocoder, dropOutOfState, fillCoordinates, type Geocoder } from "../geocode.js";
import { createHttpClient } from "../http.js";
import { eventId, importWindow } from "../ids.js";
import { resolveImages } from "../images.js";
import { writeJson } from "../io.js";
import { fetchAllSources } from "../sources/index.js";
import { RawEventSchema } from "../types.js";
import type { EventSource, HttpClient, Logger, RawEvent } from "../types.js";
import { validateEvents } from "../validate.js";

export async function runFetch(
  opts: {
    now?: Date;
    log?: Logger;
    sources?: readonly string[];
    paths?: { raw: string };
    /** Dependency overrides for tests; defaults are the real network client, geocoder and sources. */
    http?: HttpClient;
    geocoder?: Geocoder;
    sourceOverrides?: readonly EventSource[];
  } = {},
): Promise<{ written: number; path: string }> {
  const log = opts.log ?? console.log;
  const now = opts.now ?? new Date();
  const outPath = opts.paths?.raw ?? PATHS.raw;
  const window = importWindow(now);
  const http = opts.http ?? createHttpClient({ log });

  const { events: fetched, report } = await fetchAllSources(opts.sources ?? SOURCES.enabled, { http, window, log }, opts.sourceOverrides);
  log("Sources:");
  for (const r of report) log(`  ${r.source}: ${r.count} events${r.error ? ` (ERROR: ${r.error})` : ""}`);

  const { kept, dropped } = validateEvents(fetched, window);
  const byReason = new Map<string, number>();
  for (const d of dropped) byReason.set(d.reason, (byReason.get(d.reason) ?? 0) + 1);
  log(`Dropped ${dropped.length} invalid events${byReason.size ? ": " + [...byReason].map(([r, n]) => `${r} x${n}`).join(", ") : ""}`);

  const deduped = dedupeEvents(kept);
  log(`Dedupe merged ${kept.length - deduped.length} duplicates (${deduped.length} remain)`);

  const geocoder = opts.geocoder ?? createGeocoder();
  const located = await fillCoordinates(deduped, geocoder, log);
  const { kept: inState, dropped: outOfState } = await dropOutOfState(located, geocoder, log);
  await geocoder.save();
  if (outOfState.length > 0) log(`Dropped ${outOfState.length} events whose venue is outside Massachusetts`);

  const withImages = await resolveImages(inState, http, log);
  const noImage = withImages.filter((e) => !e.imageUrl).length;
  log(`Images: ${withImages.length - noImage} found, ${noImage} missing (defaults are filled at save time)`);

  const seen = new Set<string>();
  const raw: RawEvent[] = [];
  for (const e of withImages) {
    const candidate = { ...e, id: eventId(e) };
    if (seen.has(candidate.id)) continue;
    const parsed = RawEventSchema.safeParse(candidate);
    if (!parsed.success) {
      log(`  skipping invalid event "${e.title}": ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
      continue;
    }
    seen.add(candidate.id);
    raw.push(parsed.data);
  }
  raw.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  await writeJson(outPath, raw);
  log(`Wrote ${raw.length} events to ${outPath}`);
  return { written: raw.length, path: outPath };
}

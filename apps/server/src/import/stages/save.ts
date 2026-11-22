import { access } from "node:fs/promises";
import { PATHS } from "../config.js";
import { getPool, withTransaction } from "../../db/pool.js";
import { insertImportedEvents } from "../../db/importedEvents.js";
import { pickDefaultImage } from "../images.js";
import { readJsonArray, readTagsLenient } from "../io.js";
import { RawEventSchema } from "../types.js";
import type { Logger, TaggedEvent } from "../types.js";
import { isUpcoming } from "../validate.js";

export type SaveResult = { inserted: number; skipped: number; untagged: number; expired: number };

export async function runSave(
  opts: { dryRun?: boolean; now?: Date; log?: Logger; paths?: { raw: string; tags: string } } = {},
): Promise<SaveResult> {
  const log = opts.log ?? console.log;
  const now = opts.now ?? new Date();
  const paths = opts.paths ?? PATHS;
  const raw = await readJsonArray(paths.raw, RawEventSchema);
  try {
    await access(paths.tags);
  } catch {
    throw new Error(`No tags file at ${paths.tags}. Tag the events first: npm run import:normalize (API) or the Claude Code step in src/import/README.md.`);
  }
  const tagList = await readTagsLenient(paths.tags, log, true);
  const tags = new Map(tagList.map((a) => [a.id, a]));
  const rawIds = new Set(raw.map((e) => e.id));
  const orphans = tagList.filter((a) => !rawIds.has(a.id)).length;
  if (orphans > 0) log(`${orphans} tags don't match current events and were ignored`);

  const events: TaggedEvent[] = [];
  const untaggedTitles: string[] = [];
  let expired = 0;
  const notEvents: string[] = [];
  for (const e of raw) {
    const annotation = tags.get(e.id);
    if (!annotation) {
      untaggedTitles.push(e.title);
      continue;
    }
    if (annotation.notAnEvent) {
      notEvents.push(e.title);
      continue;
    }
    if (!isUpcoming(e.startsAt, now)) {
      expired++;
      continue;
    }
    events.push({
      ...e,
      description: annotation.description,
      tags: annotation.tags,
      imageUrl: e.imageUrl ?? pickDefaultImage(annotation.tags, e.id).url,
    });
  }

  const untagged = untaggedTitles.length;
  if (untagged > 0) {
    log(`${untagged} events have no tags and will not be saved (run the normalize step): ${untaggedTitles.slice(0, 5).join("; ")}${untagged > 5 ? "; ..." : ""}`);
  }
  if (expired > 0) log(`${expired} events already started and were dropped`);
  if (notEvents.length > 0) {
    log(`${notEvents.length} listings marked "not an event" were skipped: ${notEvents.slice(0, 5).join("; ")}${notEvents.length > 5 ? "; ..." : ""}`);
  }

  if (opts.dryRun) {
    log(`Dry run: ${events.length} events would be saved. Samples:`);
    for (const sample of events.slice(0, 3)) log(JSON.stringify(sample, null, 2));
    return { inserted: 0, skipped: 0, untagged, expired };
  }

  // The CLI closes the pool; tests share one.
  const { inserted, skipped } = await withTransaction((client) => insertImportedEvents(client, events));
  log(`Saved ${inserted} new events (${skipped} already present)`);
  return { inserted, skipped, untagged, expired };
}

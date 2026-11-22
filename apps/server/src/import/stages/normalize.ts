import Anthropic from "@anthropic-ai/sdk";
import { PATHS } from "../config.js";
import { readJsonArray, readTagsLenient, writeJson } from "../io.js";
import { tagEvents } from "../normalize.js";
import { RawEventSchema } from "../types.js";
import type { Logger, TagAnnotation } from "../types.js";

export async function runNormalize(
  opts: { client?: Anthropic; log?: Logger; batchSize?: number; paths?: { raw: string; tags: string } } = {},
): Promise<{ tagged: number; remaining: number }> {
  const log = opts.log ?? console.log;
  const paths = opts.paths ?? PATHS;
  const raw = await readJsonArray(paths.raw, RawEventSchema);
  const rawIds = new Set(raw.map((e) => e.id));
  const existing = await readTagsLenient(paths.tags, log);
  // All valid annotations stay in the written file, even ones for events no longer in the raw file.
  const all = new Map<string, TagAnnotation>(existing.map((a) => [a.id, a]));
  const orphans = existing.filter((a) => !rawIds.has(a.id)).length;
  const todo = raw.filter((e) => !all.has(e.id));
  log(`${raw.length} events: ${raw.length - todo.length} already tagged, ${todo.length} to tag`);
  if (orphans > 0) log(`${orphans} tags don't match current events (kept)`);

  if (todo.length > 0) {
    const client = opts.client ?? new Anthropic();
    await tagEvents(todo, {
      client,
      log,
      batchSize: opts.batchSize,
      onBatch: async (annotations) => {
        for (const a of annotations) all.set(a.id, a);
        await writeJson(paths.tags, [...all.values()]);
      },
    });
  }

  const remaining = raw.filter((e) => !all.has(e.id)).length;
  const tagged = raw.length - remaining;
  log(`Tagged ${tagged} of ${raw.length} events${remaining ? `; ${remaining} still untagged (re-run to retry)` : ""}`);
  return { tagged, remaining };
}

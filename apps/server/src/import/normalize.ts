import { readFile } from "node:fs/promises";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { TAGS } from "../tags.js";
import { LLM, TIMEZONE } from "./config.js";
import { RAW_DESCRIPTION_MAX, TagAnnotationSchema } from "./types.js";
import type { Logger, RawEvent, TagAnnotation } from "./types.js";

const OutputSchema = z.object({
  events: z.array(z.object({ id: z.string(), description: z.string(), tags: z.array(z.enum(TAGS)), notAnEvent: z.boolean() })),
});

const TAG_SET: ReadonlySet<string> = new Set(TAGS);
const INPUT_DESCRIPTION_MAX = 500;
const noop: Logger = () => {};

const whenFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: TIMEZONE,
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** "Sat Nov 21, 7:30 PM" in Boston time. */
function humanWhen(startsAt: string): string {
  const parts = Object.fromEntries(whenFormat.formatToParts(new Date(startsAt)).map((p) => [p.type, p.value]));
  return `${parts.weekday} ${parts.month} ${parts.day}, ${parts.hour}:${parts.minute} ${parts.dayPeriod}`;
}

function truncateAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : cut).trim();
}

/** One compact JSON object per line; only the fields the tagger needs. */
export function buildTaggingInput(events: RawEvent[]): string {
  return events
    .map((e) =>
      JSON.stringify({
        id: e.id,
        title: e.title,
        description: e.description ? truncateAtWord(e.description, INPUT_DESCRIPTION_MAX) : null,
        when: humanWhen(e.startsAt),
        location: e.location,
        hints: e.hints,
      }),
    )
    .join("\n");
}

export async function loadTaggingInstructions(): Promise<string> {
  return readFile(new URL("./TAGGING.md", import.meta.url), "utf8");
}

/** Validates the model's items against the batch; see TAGGING.md for the rules it was given. */
function cleanItems(items: z.infer<typeof OutputSchema>["events"], batch: RawEvent[]): TagAnnotation[] {
  const allowed = new Set(batch.map((e) => e.id));
  const seen = new Set<string>();
  const result: TagAnnotation[] = [];
  for (const item of items) {
    if (!allowed.has(item.id) || seen.has(item.id)) continue;
    const parsed = TagAnnotationSchema.safeParse({
      id: item.id,
      description: truncateAtWord(item.description.trim(), RAW_DESCRIPTION_MAX),
      tags: [...new Set(item.tags)].filter((t) => TAG_SET.has(t)).slice(0, 3),
      ...(item.notAnEvent ? { notAnEvent: true } : {}),
    });
    if (!parsed.success) continue;
    seen.add(item.id);
    result.push(parsed.data);
  }
  return result;
}

async function callOnce(client: Anthropic, batch: RawEvent[], instructions: string, log: Logger): Promise<TagAnnotation[] | "too_long" | "skip"> {
  let response;
  try {
    response = await client.messages.parse({
      model: LLM.model,
      max_tokens: LLM.maxTokens,
      system: instructions,
      messages: [{ role: "user", content: buildTaggingInput(batch) }],
      output_config: { format: zodOutputFormat(OutputSchema), effort: "low" },
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      throw new Error("Anthropic authentication failed: set ANTHROPIC_API_KEY in apps/server/.env (or run the manual step, see README).");
    }
    // The SDK throws a plain AnthropicError when the structured reply is truncated or invalid JSON
    // (it never returns with stop_reason max_tokens): treat it as too long so the batch gets split.
    if (error instanceof Anthropic.AnthropicError && !(error instanceof Anthropic.APIError)) {
      log(`  could not parse the model reply for a batch of ${batch.length} events (${error.message})`);
      return "too_long";
    }
    throw error; // BadRequestError and everything else propagate; tagEvents decides what to keep
  }
  if (response.stop_reason === "refusal") {
    log(`  model refused a batch of ${batch.length} events; skipping it`);
    return "skip";
  }
  if (response.stop_reason === "max_tokens") return "too_long";
  if (!response.parsed_output) {
    log(`  could not parse the model reply for a batch of ${batch.length} events`);
    return "skip";
  }
  return cleanItems(response.parsed_output.events, batch);
}

/** Tags one batch. Splits on max_tokens / unparseable replies; retries events missing from the reply once. */
export async function tagBatch(client: Anthropic, events: RawEvent[], instructions: string, log: Logger = noop): Promise<TagAnnotation[]> {
  if (events.length === 0) return [];
  const first = await callOnce(client, events, instructions, log);
  if (first === "too_long") {
    if (events.length === 1) {
      log(`  reply too long or unparseable for a single event "${events[0].title}"; leaving untagged`);
      return [];
    }
    const mid = Math.ceil(events.length / 2);
    const left = await tagBatch(client, events.slice(0, mid), instructions, log);
    const right = await tagBatch(client, events.slice(mid), instructions, log);
    return [...left, ...right];
  }

  if (first === "skip") return [];

  const got = new Set(first.map((a) => a.id));
  const missing = events.filter((e) => !got.has(e.id));
  if (missing.length === 0) return first;

  log(`  ${missing.length} events missing from the reply; retrying`);
  const retryBatch = missing.length === events.length ? missing.slice(0, Math.ceil(missing.length / 2)) : missing;
  const rest = missing.filter((e) => !retryBatch.includes(e));
  const retried: TagAnnotation[] = [];
  for (const part of [retryBatch, rest]) {
    if (part.length === 0) continue;
    const again = await callOnce(client, part, instructions, log);
    if (again !== "too_long" && again !== "skip") retried.push(...again);
  }
  const done = new Set([...got, ...retried.map((a) => a.id)]);
  const stillMissing = events.filter((e) => !done.has(e.id));
  if (stillMissing.length > 0) log(`  ${stillMissing.length} events left untagged: ${stillMissing.slice(0, 3).map((e) => e.title).join("; ")}`);
  return [...first, ...retried];
}

export async function tagEvents(
  events: RawEvent[],
  opts: { client: Anthropic; batchSize?: number; log?: Logger; onBatch?: (annotations: TagAnnotation[]) => Promise<void> },
): Promise<TagAnnotation[]> {
  const log = opts.log ?? noop;
  const size = opts.batchSize ?? LLM.batchSize;
  const instructions = await loadTaggingInstructions();
  const all: TagAnnotation[] = [];
  for (let i = 0; i < events.length; i += size) {
    const batch = events.slice(i, i + size);
    log(`Tagging events ${i + 1}-${i + batch.length} of ${events.length}...`);
    let annotations: TagAnnotation[];
    try {
      annotations = await tagBatch(opts.client, batch, instructions, log);
    } catch (error) {
      if (error instanceof Anthropic.BadRequestError || !(error instanceof Anthropic.APIError)) throw error;
      // Rate limit / connection / 5xx after the SDK's own retries: stop, keep what we have.
      log(`Stopping early: ${(error as Error).message}. Progress is saved; re-run to continue.`);
      break;
    }
    all.push(...annotations);
    if (opts.onBatch) await opts.onBatch(annotations);
  }
  return all;
}

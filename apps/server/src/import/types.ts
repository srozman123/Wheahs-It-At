import { z } from "zod";
import { TAGS } from "../tags.js";

// The contract between the three import stages. Every stage validates its input file
// against these schemas, so a hand-edited or LLM-written file can't sneak bad data through.
//
//   stage 1 (fetch)     -> data/events_raw.json   : RawEvent[]
//   stage 2 (normalize) -> data/events_tags.json  : TagAnnotation[]   (keyed by RawEvent.id)
//   stage 3 (save)      -> merges the two by id and inserts into the events table
//
// Stage 2 only ever adds a description + tags. It never rewrites facts (title, time, place),
// so the LLM (API or a person in Claude Code) can't invent or change event data.

const nullableText = z.string().trim().min(1).nullable();
const price = z.number().nonnegative().max(999_999.99).nullable();

/** What a source fetcher returns: one row per occurrence (recurring events already expanded). */
export const SourceEventSchema = z.object({
  source: z.string().min(1), // e.g. "eventbrite"
  title: z.string().trim().min(1),
  description: nullableText, // from the source, if it has one
  startsAt: z.iso.datetime({ offset: true }), // ISO 8601 with offset, America/New_York wall time
  location: nullableText, // venue / neighborhood
  address: nullableText,
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
  imageUrl: z.url().nullable(),
  sourceUrl: z.url(),
  priceMin: price, // both 0 = free, both null = unknown
  priceMax: price,
  hints: z.array(z.string()), // source categories/keywords; only used to help tagging
});
export type SourceEvent = z.infer<typeof SourceEventSchema>;

/** A cleaned, deduped event in events_raw.json. `id` is stable across runs (see eventId()). */
export const RawEventSchema = SourceEventSchema.extend({
  id: z.string().regex(/^[a-f0-9]{16}$/),
});
export type RawEvent = z.infer<typeof RawEventSchema>;

export const RAW_DESCRIPTION_MAX = 300;

/** One entry in events_tags.json: what stage 2 adds to a RawEvent. */
export const TagAnnotationSchema = z.object({
  id: z.string().regex(/^[a-f0-9]{16}$/),
  description: z.string().trim().min(1).max(RAW_DESCRIPTION_MAX),
  tags: z.array(z.enum(TAGS)).min(1).max(3),
  /** True when the listing isn't something to attend (recess, deadline, promo, placeholder): save skips it. */
  notAnEvent: z.boolean().optional(),
});
export type TagAnnotation = z.infer<typeof TagAnnotationSchema>;

/** A RawEvent merged with its annotation: exactly what stage 3 inserts. */
export type TaggedEvent = RawEvent & { description: string; tags: TagAnnotation["tags"] };

/** Time window an import run keeps events for. */
export type ImportWindow = { start: Date; end: Date };

/** Minimal HTTP surface sources use. Injected so tests can feed saved pages instead of the network. */
export interface HttpClient {
  getText(url: string): Promise<string>;
  getJson<T = unknown>(url: string): Promise<T>;
  /** Content-Type of the URL (HEAD, falling back to GET), or null if it doesn't load. */
  contentType(url: string): Promise<string | null>;
}

export type Logger = (message: string) => void;

export type SourceContext = { http: HttpClient; window: ImportWindow; log: Logger };

export interface EventSource {
  name: string;
  fetch(ctx: SourceContext): Promise<SourceEvent[]>;
}

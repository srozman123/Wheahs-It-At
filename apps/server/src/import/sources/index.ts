import type { EventSource, SourceContext, SourceEvent } from "../types.js";
import { bostonCalendarSource } from "./bostonCalendar.js";
import { buSource } from "./bu.js";
import { do617Source } from "./do617.js";
import { eventbriteSource } from "./eventbrite.js";
import { harvardSource } from "./harvard.js";
import { mitSource, northeasternSource } from "./localist.js";
import { meetupSource } from "./meetup.js";

const all: EventSource[] = [bostonCalendarSource, eventbriteSource, do617Source, northeasternSource, mitSource, harvardSource, buSource, meetupSource];

export const SOURCES_BY_NAME: Readonly<Record<string, EventSource>> = Object.freeze(Object.fromEntries(all.map((s) => [s.name, s])));

export type SourceReport = { source: string; count: number; error?: string };

/** Runs sources one after another. One failing site never stops the run; it just gets an error entry. */
export async function fetchAllSources(
  names: readonly string[],
  ctx: SourceContext,
  overrides: readonly EventSource[] = [],
): Promise<{ events: SourceEvent[]; report: SourceReport[] }> {
  const events: SourceEvent[] = [];
  const report: SourceReport[] = [];
  for (const name of names) {
    const source = overrides.find((s) => s.name === name) ?? SOURCES_BY_NAME[name];
    if (!source) {
      report.push({ source: name, count: 0, error: `unknown source "${name}"` });
      continue;
    }
    try {
      const found = await source.fetch(ctx);
      events.push(...found);
      report.push({ source: name, count: found.length });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      ctx.log(`[${name}] failed: ${error}`);
      report.push({ source: name, count: 0, error });
    }
  }
  return { events, report };
}

import type { ImportWindow, SourceEvent } from "./types.js";

/** One SourceEvent per start inside the window (inclusive), deduped by instant and sorted ascending. */
export function expandOccurrences(base: Omit<SourceEvent, "startsAt">, starts: string[], window: ImportWindow): SourceEvent[] {
  const seen = new Map<number, string>();
  for (const s of starts) {
    const ms = new Date(s).getTime();
    if (Number.isNaN(ms) || ms < window.start.getTime() || ms > window.end.getTime()) continue;
    if (!seen.has(ms)) seen.set(ms, s);
  }
  return [...seen.entries()].sort((a, b) => a[0] - b[0]).map(([, startsAt]) => ({ ...base, hints: [...base.hints], startsAt }));
}

import { createHash } from "node:crypto";
import { WINDOW_DAYS } from "./config.js";
import type { ImportWindow, SourceEvent } from "./types.js";

/** Stable 16-hex id for an event occurrence: same source URL + start time => same id across runs. */
export function eventId(event: Pick<SourceEvent, "sourceUrl" | "startsAt">): string {
  const startMs = new Date(event.startsAt).getTime(); // normalizes offset spelling
  return createHash("sha256").update(`${event.sourceUrl}|${startMs}`).digest("hex").slice(0, 16);
}

/** The window an import run keeps: from `now` to WINDOW_DAYS later. */
export function importWindow(now: Date = new Date(), days: number = WINDOW_DAYS): ImportWindow {
  return { start: now, end: new Date(now.getTime() + days * 24 * 60 * 60 * 1000) };
}

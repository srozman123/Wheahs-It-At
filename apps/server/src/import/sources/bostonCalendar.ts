import { readFile } from "node:fs/promises";
import { PATHS } from "../config.js";
import { nyLocalToIso, toNyIso } from "../time.js";
import type { EventSource } from "../types.js";
import { cleanText, finalize, str } from "./util.js";

/** Reads the JSON written by tools/parse_bostoncalendar.py. ongoing_until is ignored: start time stays as-is. */
export function createBostonCalendarSource(path: string = PATHS.bostonCalendar): EventSource {
  return {
    name: "thebostoncalendar",
    async fetch(ctx) {
      let text: string;
      try {
        text = await readFile(path, "utf8");
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "ENOENT") {
          ctx.log(`[thebostoncalendar] ${path} not found: save the page in Safari (Page Source) and run tools/parse_bostoncalendar.py`);
          return [];
        }
        throw e;
      }
      let rows: unknown;
      try {
        rows = JSON.parse(text);
      } catch (e) {
        ctx.log(`[thebostoncalendar] ${path} is not valid JSON: ${(e as Error).message}`);
        return [];
      }
      if (!Array.isArray(rows)) {
        ctx.log(`[thebostoncalendar] ${path} must contain a JSON array`);
        return [];
      }
      // The parser writes local midnight when the list shows no time; treat that as date-only.
      const startOf = (v: unknown): unknown => {
        if (typeof v !== "string") return v;
        const iso = toNyIso(v);
        return iso?.slice(10, 19) === "T00:00:00" ? nyLocalToIso(iso.slice(0, 10), null) : (iso ?? v);
      };
      const mapped = rows.map((r: Record<string, unknown>) => ({
        source: "thebostoncalendar",
        title: cleanText(r.title) ?? "",
        description: str(r.description),
        startsAt: startOf(r.starts_at),
        location: str(r.location),
        address: str(r.address),
        lat: typeof r.lat === "number" ? r.lat : null,
        lng: typeof r.lng === "number" ? r.lng : null,
        imageUrl: str(r.image_url),
        sourceUrl: r.source_url,
        priceMin: typeof r.price_min === "number" ? r.price_min : null,
        priceMax: typeof r.price_max === "number" ? r.price_max : null,
        hints: Array.isArray(r.tags) ? r.tags.filter((t): t is string => typeof t === "string") : [],
      }));
      return finalize(mapped, ctx, "thebostoncalendar");
    },
  };
}

export const bostonCalendarSource = createBostonCalendarSource();
export default bostonCalendarSource;

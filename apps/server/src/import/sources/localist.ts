import { WINDOW_DAYS } from "../config.js";
import { nyLocalToIso, toNyIso } from "../time.js";
import type { EventSource, SourceContext } from "../types.js";
import { cleanText, finalize, num, parseCost, str, type Json } from "./util.js";

/** A photo shared by this many distinct events in one feed is a generic placeholder, not a real flyer. */
const GENERIC_IMAGE_MIN_EVENTS = 3;
/** MIT athletics (and some others) publish a fake 1:00am start time; those rows are dropped. */
const FAKE_START_LOCAL_TIME = "T01:00:00";

export function createLocalistSource(name: "northeastern" | "mit", baseUrl: string): EventSource {
  return {
    name,
    async fetch(ctx: SourceContext) {
      const events: Json[] = [];
      for (let page = 1; page <= 5; page++) {
        const url = `${baseUrl}/api/2/events?days=${WINDOW_DAYS}&pp=100${page > 1 ? `&page=${page}` : ""}`;
        const data = await ctx.http.getJson<Json>(url);
        for (const w of data.events ?? []) if (w?.event) events.push(w.event);
        if (!data.page || page >= Number(data.page.total ?? 1)) break;
      }

      const photoUse = new Map<string, number>();
      for (const e of events) {
        const p = str(e.photo_url);
        if (p) photoUse.set(p, (photoUse.get(p) ?? 0) + 1);
      }

      const rows: unknown[] = [];
      let fake = 0;
      for (const e of events) {
        if (e.experience === "virtual" || e.status === "canceled") continue;
        const photo = str(e.photo_url);
        const imageUrl = photo && (photoUse.get(photo) ?? 0) >= GENERIC_IMAGE_MIN_EVENTS ? null : photo;
        const price = e.ticket_cost ? parseCost(String(e.ticket_cost)) : { priceMin: null, priceMax: null };
        const free = e.free === true && price.priceMin === null ? { priceMin: 0, priceMax: 0 } : price;
        const hints = ((e.filters?.event_types ?? []) as Json[]).map((t) => t.name).filter((n): n is string => typeof n === "string");
        const sourceUrl = str(e.localist_url) ?? str(e.url);
        for (const inst of (e.event_instances ?? []) as Json[]) {
          const rawStart = inst.event_instance?.start;
          const start =
            typeof rawStart !== "string" ? null : inst.event_instance.all_day ? nyLocalToIso(rawStart.slice(0, 10), null) : toNyIso(rawStart);
          if (!start) continue;
          if (start.includes(FAKE_START_LOCAL_TIME) && !inst.event_instance.all_day && hints.some((h) => /athletic/i.test(h))) {
            fake++;
            continue;
          }
          rows.push({
            source: name,
            title: cleanText(e.title) ?? "",
            description: cleanText(e.description_text) ?? cleanText(e.description),
            startsAt: start,
            location: cleanText(e.location_name) ?? cleanText(e.location),
            address: cleanText(e.address),
            lat: num(e.geo?.latitude),
            lng: num(e.geo?.longitude),
            imageUrl,
            // Instances of one event share a URL; the start time keeps ids distinct.
            sourceUrl,
            ...free,
            hints,
          });
        }
      }
      if (fake) ctx.log(`[${name}] dropped ${fake} athletics rows with a fake 1:00am start`);
      return finalize(rows, ctx, name);
    },
  };
}

export const northeasternSource = createLocalistSource("northeastern", "https://calendar.northeastern.edu");
export const mitSource = createLocalistSource("mit", "https://calendar.mit.edu");


import { nyLocalToIso, toNyIso } from "../time.js";
import type { EventSource } from "../types.js";
import { cleanText, finalize, num, parseCost, str, type Json } from "./util.js";

const URL_ =
  "https://events.college.harvard.edu/live/json/events/max/100/response_fields/location,location_latitude,location_longitude,thumbnail,summary,cost,tags,event_types/thumb_width/800/thumb_height/600";

export const harvardSource: EventSource = {
  name: "harvard",
  async fetch(ctx) {
    const res = await ctx.http.getJson<Json>(URL_);
    const data: Json[] = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
    if (data.length === 0) ctx.log("[harvard] response contained no events");
    const rows = data
      .filter((e) => !e.is_online && !e.is_canceled)
      .map((e) => ({
        source: "harvard",
        title: cleanText(e.title) ?? "",
        description: cleanText(e.summary),
        startsAt: typeof e.date_iso !== "string"
            ? null
            : e.is_all_day
              ? nyLocalToIso(e.date_iso.slice(0, 10), null)
              : (toNyIso(e.date_iso) ?? e.date_iso),
        location: cleanText(e.location_title) ?? cleanText(e.location),
        address: null,
        lat: num(e.location_latitude),
        lng: num(e.location_longitude),
        imageUrl: str(e.thumbnail),
        sourceUrl: e.url,
        ...parseCost(typeof e.cost === "string" ? cleanText(e.cost) : null),
        hints: [...(e.event_types ?? []), ...(e.tags ?? [])].filter((x: unknown): x is string => typeof x === "string"),
      }));
    return finalize(rows, ctx, "harvard");
  },
};

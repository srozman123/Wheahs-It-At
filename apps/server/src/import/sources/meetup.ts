import { toNyIso } from "../time.js";
import type { EventSource } from "../types.js";
import { cleanText, errMsg, finalize, str, type Json } from "./util.js";

const URL_ = "https://www.meetup.com/find/?location=us--ma--Boston&source=EVENTS";

/** Reads Event entries out of the Apollo cache in __NEXT_DATA__. Returns null if the shape isn't recognized. */
export function parseMeetupHtml(html: string): unknown[] | null {
  const m = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html);
  if (!m) return null;
  let state: Json | undefined;
  try {
    state = JSON.parse(m[1])?.props?.pageProps?.__APOLLO_STATE__;
  } catch {
    return null;
  }
  if (!state) return null;
  const rows: unknown[] = [];
  for (const [key, e] of Object.entries<Json>(state)) {
    if (!key.startsWith("Event:") || typeof e?.title !== "string") continue; // ref-only stubs have no title
    if (e.eventType === "ONLINE") continue;
    const venue: Json = e.venue ?? {};
    if (venue.state && String(venue.state).toUpperCase() !== "MA") continue;
    const photo: Json | undefined = state[e.displayPhoto?.__ref ?? ""] ?? state[e.featuredEventPhoto?.__ref ?? ""];
    const amount = typeof e.feeSettings?.amount === "number" ? e.feeSettings.amount : null;
    rows.push({
      source: "meetup",
      title: cleanText(e.title) ?? "",
      description: cleanText(e.description, 400),
      startsAt: typeof e.dateTime === "string" ? (toNyIso(e.dateTime) ?? e.dateTime) : null,
      location: cleanText(venue.name),
      address: cleanText([venue.address, venue.city].filter(Boolean).join(", ")),
      lat: typeof venue.lat === "number" ? venue.lat : null,
      lng: typeof venue.lon === "number" ? venue.lon : null,
      imageUrl: str(photo?.highResUrl),
      sourceUrl: e.eventUrl,
      priceMin: amount,
      priceMax: amount,
      hints: [],
    });
  }
  return rows;
}

export const meetupSource: EventSource = {
  name: "meetup",
  async fetch(ctx) {
    try {
      const rows = parseMeetupHtml(await ctx.http.getText(URL_));
      if (rows === null) {
        ctx.log("[meetup] page format not recognized (no __NEXT_DATA__ Apollo state); returning no events");
        return [];
      }
      return finalize(rows, ctx, "meetup");
    } catch (e) {
      ctx.log(`[meetup] failed: ${errMsg(e)}`);
      return [];
    }
  },
};

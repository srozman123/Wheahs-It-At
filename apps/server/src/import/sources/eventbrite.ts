import { SOURCES } from "../config.js";
import { toNyIso } from "../time.js";
import type { EventSource, SourceContext } from "../types.js";
import { cleanText, errMsg, finalize, num, str, type Json } from "./util.js";

const BASE = "https://www.eventbrite.com/d/ma--boston/events--this-week/";

/** Flattens JSON-LD (Event, array, ItemList with itemListElement[].item, @graph) into Event objects. */
export function extractLdEvents(html: string): Json[] {
  const out: Json[] = [];
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== "object") return;
    const o = node as Json;
    const type = ([] as string[]).concat(o["@type"] ?? []);
    if (type.some((t) => /Event$/.test(t))) out.push(o);
    else if (Array.isArray(o.itemListElement)) o.itemListElement.forEach((el: Json) => visit(el?.item ?? el));
    else if (Array.isArray(o["@graph"])) visit(o["@graph"]);
  };
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      visit(JSON.parse(m[1]));
    } catch {
      /* skip malformed block */
    }
  }
  return out;
}

function prices(offers: unknown): { priceMin: number | null; priceMax: number | null } {
  const list = ([] as Json[]).concat((offers as Json) ?? []);
  const vals: number[] = [];
  for (const o of list) {
    for (const k of ["lowPrice", "highPrice", "price"]) {
      const n = num(o?.[k]);
      if (n !== null) vals.push(n);
    }
  }
  return vals.length ? { priceMin: Math.min(...vals), priceMax: Math.max(...vals) } : { priceMin: null, priceMax: null };
}

export function parseEventbriteHtml(html: string): unknown[] {
  return extractLdEvents(html).map((e) => {
    const loc = ([] as Json[]).concat(e.location ?? [])[0] ?? {};
    const addr = loc.address && typeof loc.address === "object" ? loc.address : {};
    const addrText = typeof loc.address === "string" ? loc.address : [addr.streetAddress, addr.addressLocality].filter(Boolean).join(", ");
    const image = Array.isArray(e.image) ? e.image[0] : e.image;
    const online = typeof e.eventAttendanceMode === "string" && /Online/.test(e.eventAttendanceMode) && !/Mixed|Offline/.test(e.eventAttendanceMode);
    return {
      online,
      row: {
        source: "eventbrite",
        title: cleanText(e.name) ?? "",
        description: cleanText(e.description),
        startsAt: typeof e.startDate === "string" ? (toNyIso(e.startDate) ?? e.startDate) : null,
        location: cleanText(loc.name),
        address: cleanText(addrText),
        lat: num(loc.geo?.latitude),
        lng: num(loc.geo?.longitude),
        imageUrl: str(typeof image === "object" ? image?.url : image),
        sourceUrl: e.url,
        ...prices(e.offers),
        hints: [],
      },
    };
  }).filter((x) => !x.online).map((x) => x.row);
}

export const eventbriteSource: EventSource = {
  name: "eventbrite",
  async fetch(ctx: SourceContext) {
    const rows: unknown[] = [];
    for (let page = 1; page <= SOURCES.eventbritePages; page++) {
      const url = page === 1 ? BASE : `${BASE}?page=${page}`;
      try {
        const found = parseEventbriteHtml(await ctx.http.getText(url));
        rows.push(...found);
        if (found.length === 0) break;
      } catch (e) {
        if (page === 1) throw e;
        ctx.log(`[eventbrite] page ${page} failed: ${errMsg(e)}`);
        break;
      }
    }
    return finalize(rows, ctx, "eventbrite");
  },
};

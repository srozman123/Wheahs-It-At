import { nyLocalToIso, windowDays } from "../time.js";
import type { EventSource, SourceContext } from "../types.js";
import { absUrl, cleanText, decodeEntities, errMsg, finalize, ogImage } from "./util.js";

const BASE = "https://do617.com/events";
const MAX_PAGES = 3;
const MAX_DETAIL_FETCHES = 40;

/** "6 pm" -> "18:00", "7:30 pm" -> "19:30", "noon" -> "12:00". Takes the first time in the text. */
export function parseClock(text: string): string | null {
  if (/\bnoon\b/i.test(text)) return "12:00";
  const m = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i.exec(text);
  if (!m) return null;
  let h = Number(m[1]) % 12;
  if (m[3].toLowerCase() === "pm") h += 12;
  return `${String(h).padStart(2, "0")}:${m[2] ?? "00"}`;
}

export type Do617Card = {
  title: string;
  url: string;
  date: string; // YYYY-MM-DD from the link
  dateText: string | null;
  venue: string | null;
  hints: string[];
  imageUrl: string | null;
};

/** Parses the server-rendered cards. Links look like ./events/YYYY/MM/DD/<slug> (or /events/...). */
export function parseDo617Html(html: string): Do617Card[] {
  const cards: Do617Card[] = [];
  const parts = html.split(/data-card-kind="event"/).slice(1);
  for (const part of parts) {
    const chunk = part.split(/data-card-kind="/)[0];
    const link = /<a[^>]+href="((?:\.|https:\/\/do617\.com)?\/?events\/(\d{4})\/(\d{2})\/(\d{2})\/[^"#]+)/.exec(chunk);
    if (!link) continue;
    const url = absUrl(link[1].replace(/^\.?\/?/, link[1].startsWith("http") ? "" : "/"), "https://do617.com/");
    if (!url) continue;
    const title =
      cleanText(/<h3[^>]*>([\s\S]*?)<\/h3>/.exec(chunk)?.[1]) ?? cleanText(/aria-label="([^"]*)"/.exec(chunk)?.[1]);
    if (!title) continue;
    const img = /<img[^>]+src="([^"]+)"/.exec(chunk)?.[1];
    let dateText: string | null = null;
    let venue: string | null = null;
    let hints: string[] = [];
    for (const p of chunk.matchAll(/<p([^>]*)>([\s\S]*?)<\/p>/g)) {
      const cls = /class="([^"]*)"/.exec(p[1])?.[1] ?? "";
      const text = cleanText(p[2]);
      if (!text) continue;
      if (/\bdate\b/.test(cls)) dateText = text;
      else if (/enrichment/.test(cls)) hints = text.split("•").map((s) => s.trim()).filter(Boolean);
      else if (!venue) venue = text;
    }
    cards.push({
      title,
      url,
      date: `${link[2]}-${link[3]}-${link[4]}`,
      dateText,
      venue,
      hints,
      imageUrl: img ? absUrl(img, "https://do617.com/") : null,
    });
  }
  return cards;
}

export const do617Source: EventSource = {
  name: "do617",
  async fetch(ctx: SourceContext) {
    const cards: Do617Card[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      try {
        const found = parseDo617Html(await ctx.http.getText(page === 1 ? BASE : `${BASE}?page=${page}`));
        cards.push(...found);
        if (found.length === 0) break;
      } catch (e) {
        if (page === 1) throw e;
        ctx.log(`[do617] page ${page} failed: ${errMsg(e)}`);
        break;
      }
    }
    const today = windowDays(ctx.window)[0];
    let detailFetches = 0;
    const rows: unknown[] = [];
    for (const c of cards) {
      // Multi-day runs ("Nov 18 - Dec 6 | 7 am") link to their first day; show them from today.
      const ongoing = c.dateText !== null && /[A-Za-z]{3,}\s+\d+\s*-\s*[A-Za-z]{3,}\s+\d+/.test(c.dateText) && c.date < today;
      let imageUrl = c.imageUrl;
      if (!imageUrl && detailFetches < MAX_DETAIL_FETCHES) {
        detailFetches++;
        try {
          imageUrl = ogImage(await ctx.http.getText(c.url));
        } catch (e) {
          ctx.log(`[do617] detail ${c.url} failed: ${errMsg(e)}`);
        }
      }
      const timePart = c.dateText?.includes("|") ? c.dateText.split("|").slice(1).join("|") : (c.dateText ?? "");
      rows.push({
        source: "do617",
        title: decodeEntities(c.title),
        description: null,
        startsAt: nyLocalToIso(ongoing ? today : c.date, parseClock(timePart)),
        location: c.venue,
        address: null,
        lat: null,
        lng: null,
        imageUrl,
        sourceUrl: c.url,
        priceMin: null,
        priceMax: null,
        hints: c.hints,
      });
    }
    if (detailFetches >= MAX_DETAIL_FETCHES) ctx.log(`[do617] detail fetches capped at ${MAX_DETAIL_FETCHES}`);
    return finalize(rows, ctx, "do617");
  },
};


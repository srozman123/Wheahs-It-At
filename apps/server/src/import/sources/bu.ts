import { SOURCES } from "../config.js";
import { nyLocalToIso, toNyIso, windowDays } from "../time.js";
import type { EventSource } from "../types.js";
import { cleanText, errMsg, finalize, num, str, type Json } from "./util.js";

const RPC = "https://www.bu.edu/calendar/rpc";

const FEE_FIELDS = ["X-BU-FEEGENERAL", "X-BU-FEEPUBLIC", "X-BU-FEESTUDENT", "X-BU-FEEBUSTUDENT", "X-BU-FEESENIOR", "X-BU-FEESTAFF", "X-BU-FEE"];

export function buPrices(d: Json): { priceMin: number | null; priceMax: number | null } {
  const nums = FEE_FIELDS.map((k) => (typeof d[k] === "string" && d[k].trim() ? Number(d[k].replace(/[$,]/g, "")) : NaN)).filter(Number.isFinite);
  if (nums.length) return { priceMin: Math.min(...nums), priceMax: Math.max(...nums) };
  if (/^free$/i.test(str(d["X-BU-FEES"]) ?? "")) return { priceMin: 0, priceMax: 0 };
  return { priceMin: null, priceMax: null };
}

export const buSource: EventSource = {
  name: "bu",
  async fetch(ctx) {
    const items: { uid: string; day: string; title: string; ts: number | null }[] = [];
    for (const iso of windowDays(ctx.window)) {
      const day = iso.replaceAll("-", "");
      try {
        const res = await ctx.http.getJson<Json>(`${RPC}/events.json.php?day=${day}`);
        const r = res?.ResultSet?.Result;
        for (const it of Array.isArray(r) ? r : r ? [r] : []) {
          if (typeof it.uid === "string") items.push({ uid: it.uid, day, title: it.SUMMARY ?? "", ts: num(it.time_stamp) });
        }
      } catch (e) {
        ctx.log(`[bu] day ${day} failed: ${errMsg(e)}`);
      }
    }
    ctx.log(`[bu] ${items.length} events listed across ${new Set(items.map((it) => it.day)).size} days`);
    let list = items;
    if (list.length > SOURCES.buMaxDetails) {
      // Cap per day so later days aren't silently dropped.
      const days = new Set(items.map((it) => it.day)).size;
      const perDay = Math.ceil(SOURCES.buMaxDetails / days);
      const taken = new Map<string, number>();
      list = items.filter((it) => {
        const n = (taken.get(it.day) ?? 0) + 1;
        taken.set(it.day, n);
        return n <= perDay;
      });
      ctx.log(`[bu] ${items.length} events; fetching details for ${list.length} (max ${perDay} per day)`);
    }
    const rows: unknown[] = [];
    for (const it of list) {
      try {
        const res = await ctx.http.getJson<Json>(`${RPC}/event.json.php?day=${it.day}&uid=${encodeURIComponent(it.uid)}`);
        const d: Json = res?.ResultSet?.Result;
        if (!d || Array.isArray(d)) continue;
        // The day list's time_stamp is for this day's occurrence; the detail "timestamp" can be a recurring event's first date.
        const ts = it.ts ?? num(d.timestamp);
        const startsAt = ts !== null ? toNyIso(new Date(ts * 1000).toISOString()) : nyLocalToIso(`${it.day.slice(0, 4)}-${it.day.slice(4, 6)}-${it.day.slice(6)}`, null);
        const building = str(d["X-BU-LOCATIONBUILDING"]);
        const room = str(d["X-BU-LOCATIONROOM"]);
        const external = str(d.URL);
        rows.push({
          source: "bu",
          title: cleanText(d.SUMMARY ?? it.title) ?? "",
          description: cleanText(d.DESCRIPTION, 500),
          startsAt,
          location: building ? (room ? `${building}, ${room}` : building) : null,
          address: null,
          lat: null,
          lng: null,
          imageUrl: null,
          sourceUrl: external && /^https?:\/\//.test(external) ? external : `https://www.bu.edu/calendar/?uid=${encodeURIComponent(it.uid)}`,
          ...buPrices(d),
          hints: [str(d["X-BU-CONTACTORGANIZATION"])].filter((x): x is string => !!x),
        });
      } catch (e) {
        ctx.log(`[bu] detail ${it.uid} failed: ${errMsg(e)}`);
      }
    }
    return finalize(rows, ctx, "bu");
  },
};

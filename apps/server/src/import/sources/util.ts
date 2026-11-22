import { SourceEventSchema, type ImportWindow, type SourceContext, type SourceEvent } from "../types.js";

/** Loosely typed JSON from third-party feeds. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Json = any;

const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", hellip: "…", bull: "•", middot: "·",
  eacute: "é", egrave: "è", aacute: "á", ntilde: "ñ", uuml: "ü", ouml: "ö", copy: "©",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      try {
        return String.fromCodePoint(code);
      } catch {
        return m;
      }
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}

/** Strips tags + HTML comments, decodes entities, collapses whitespace. Returns null when empty. */
export function cleanText(input: unknown, maxLen = 600): string | null {
  if (typeof input !== "string") return null;
  const text = decodeEntities(
    input
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<(br|\/p|\/div|\/li)\s*\/?>/gi, " ")
      .replace(/<[^>]*>/g, ""),
  )
    .replace(/[\s ]+/g, " ")
    .trim();
  if (!text) return null;
  return text.length > maxLen ? `${text.slice(0, maxLen - 1).trimEnd()}…` : text;
}

export type Price = { priceMin: number | null; priceMax: number | null };

/** "Free" -> 0/0, "$10" -> 10/10, "$5-$15" -> 5/15, "Free; $10 non-members" -> 0/10. Unknown -> null/null. */
export function parseCost(text: string | null | undefined): Price {
  const none = { priceMin: null, priceMax: null };
  if (!text) return none;
  const t = decodeEntities(text);
  const nums = [...t.matchAll(/\$\s?(\d+(?:,\d{3})*(?:\.\d{1,2})?)/g)].map((m) => Number(m[1].replace(/,/g, "")));
  const free = /\bfree\b/i.test(t) && !/\bnot free\b/i.test(t);
  if (nums.length === 0) return free ? { priceMin: 0, priceMax: 0 } : none;
  const lo = Math.min(...nums);
  const hi = Math.max(...nums);
  return { priceMin: free ? 0 : lo, priceMax: hi };
}

export function inWindow(startsAt: string, w: ImportWindow): boolean {
  const ms = new Date(startsAt).getTime();
  return !Number.isNaN(ms) && ms >= w.start.getTime() && ms <= w.end.getTime();
}

/** A bad (relative, malformed) image URL must never drop an event: it becomes null. */
function withValidImage(candidate: unknown): unknown {
  if (!candidate || typeof candidate !== "object") return candidate;
  const url = (candidate as { imageUrl?: unknown }).imageUrl;
  if (typeof url !== "string") return candidate;
  try {
    if (/^https?:$/.test(new URL(url).protocol)) return candidate;
  } catch {
    // relative or malformed
  }
  return { ...candidate, imageUrl: null };
}

/** Drops events outside the window or failing the schema (logging why), and returns the rest. */
export function finalize(candidates: unknown[], ctx: SourceContext, source: string): SourceEvent[] {
  const out: SourceEvent[] = [];
  const seen = new Set<string>();
  let invalid = 0;
  for (const candidate of candidates) {
    const c = withValidImage(candidate);
    const parsed = SourceEventSchema.safeParse(c);
    if (!parsed.success) {
      invalid++;
      if (invalid <= 3) ctx.log(`[${source}] dropped invalid row: ${parsed.error.issues[0]?.path.join(".")}: ${parsed.error.issues[0]?.message}`);
      continue;
    }
    const key = `${parsed.data.sourceUrl}|${new Date(parsed.data.startsAt).getTime()}`;
    if (seen.has(key) || !inWindow(parsed.data.startsAt, ctx.window)) continue;
    seen.add(key);
    out.push(parsed.data);
  }
  if (invalid > 3) ctx.log(`[${source}] ${invalid} invalid rows dropped in total`);
  return out;
}

export function absUrl(href: string | null | undefined, base: string): string | null {
  if (!href) return null;
  try {
    return new URL(decodeEntities(href), base).toString();
  } catch {
    return null;
  }
}

export function num(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
}

export function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Content of `<meta property="og:image" content="...">` (either attribute order). */
export function ogImage(html: string): string | null {
  const a = /<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["']/i.exec(html);
  const b = /<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image["']/i.exec(html);
  const v = a?.[1] ?? b?.[1];
  return v ? decodeEntities(v) : null;
}

export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

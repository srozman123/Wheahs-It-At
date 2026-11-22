import { DATE_ONLY_TIME, TIMEZONE } from "./config.js";

const fmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TIMEZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function nyParts(ms: number): { y: number; mo: number; d: number; h: number; mi: number; s: number } {
  const p: Record<string, number> = {};
  for (const part of fmt.formatToParts(new Date(ms))) if (part.type !== "literal") p[part.type] = Number(part.value);
  return { y: p.year, mo: p.month, d: p.day, h: p.hour % 24, mi: p.minute, s: p.second };
}

/** Offset (minutes, east positive) of New York at the given instant. */
function nyOffsetMinutes(ms: number): number {
  const p = nyParts(ms);
  const asUtc = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s);
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60000);
}

function offsetString(mins: number): string {
  const sign = mins < 0 ? "-" : "+";
  const a = Math.abs(mins);
  return `${sign}${String(Math.floor(a / 60)).padStart(2, "0")}:${String(a % 60).padStart(2, "0")}`;
}

const pad = (n: number) => String(n).padStart(2, "0");

function fromWall(y: number, mo: number, d: number, h: number, mi: number, s: number): string {
  const wallAsUtc = Date.UTC(y, mo - 1, d, h, mi, s);
  // Guess with the offset at (wall as UTC - 5h), then correct once; handles DST transitions.
  let off = nyOffsetMinutes(wallAsUtc + 5 * 3600_000);
  let instant = wallAsUtc - off * 60000;
  const off2 = nyOffsetMinutes(instant);
  if (off2 !== off) {
    off = off2;
    instant = wallAsUtc - off * 60000;
  }
  const norm = nyParts(instant);
  return `${norm.y}-${pad(norm.mo)}-${pad(norm.d)}T${pad(norm.h)}:${pad(norm.mi)}:${pad(norm.s)}${offsetString(nyOffsetMinutes(instant))}`;
}

/** "2026-11-21" + "19:30" (NY wall time) -> "2026-11-21T19:30:00-05:00". Null time means DATE_ONLY_TIME (noon). */
export function nyLocalToIso(date: string, time: string | null): string {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (!dm) throw new Error(`Bad date: ${date}`);
  const t = time ?? DATE_ONLY_TIME;
  const tm = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(t.trim());
  if (!tm) throw new Error(`Bad time: ${t}`);
  return fromWall(+dm[1], +dm[2], +dm[3], +tm[1], +tm[2], tm[3] ? +tm[3] : 0);
}

/** ISO with offset/Z -> NY offset form; offset-less local -> treated as NY wall time. Null if unparseable. */
export function toNyIso(input: string): string | null {
  const s = input.trim();
  const local = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?)?$/.exec(s);
  if (local) {
    try {
      if (local[4] === undefined) return nyLocalToIso(`${local[1]}-${local[2]}-${local[3]}`, null);
      return fromWall(+local[1], +local[2], +local[3], +local[4], +(local[5] ?? 0), +(local[6] ?? 0));
    } catch {
      return null;
    }
  }
  if (!/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})$/i.test(s)) return null;
  const ms = Date.parse(s.replace(" ", "T").replace(/([+-]\d{2})(\d{2})$/, "$1:$2"));
  if (Number.isNaN(ms)) return null;
  const p = nyParts(ms);
  return `${p.y}-${pad(p.mo)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}:${pad(p.s)}${offsetString(nyOffsetMinutes(ms))}`;
}

/** True if the NY wall time of this ISO string is exactly DATE_ONLY_TIME (a source gave only a date). */
export function isDateOnlyStart(startsAt: string): boolean {
  const iso = toNyIso(startsAt);
  if (!iso) return false;
  const [h, m] = DATE_ONLY_TIME.split(":").map(Number);
  return iso.slice(11, 19) === `${pad(h)}:${pad(m)}:00`;
}

/** YYYY-MM-DD of a NY ISO string's wall date. */
export function nyDateOf(iso: string): string {
  return iso.slice(0, 10);
}

/** Dates (YYYY-MM-DD, NY) from window.start's day through window.end's day. */
export function windowDays(window: { start: Date; end: Date }): string[] {
  const s = nyParts(window.start.getTime());
  const e = nyParts(window.end.getTime());
  const out: string[] = [];
  const endKey = Date.UTC(e.y, e.mo - 1, e.d);
  for (let t = Date.UTC(s.y, s.mo - 1, s.d); t <= endKey; t += 86400_000) {
    const d = new Date(t);
    out.push(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`);
  }
  return out;
}

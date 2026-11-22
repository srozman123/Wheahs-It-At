const DAY = 86_400_000;

function startOfDay(d: Date) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function clock(d: Date) {
  const h = d.getHours();
  const m = d.getMinutes();
  const suffix = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2, '0')}${suffix}`;
}

/** Day label: "Today" / "Tonight" / "Tomorrow" / "Friday". */
export function dayLabel(iso: string, now = new Date()) {
  const d = new Date(iso);
  const diff = Math.round((startOfDay(d).getTime() - startOfDay(now).getTime()) / DAY);
  if (diff === 0) return d.getHours() >= 17 ? 'Tonight' : 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff > 1 && diff < 7) return d.toLocaleDateString('en-US', { weekday: 'long' });
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/** Card-friendly time: "Tonight 8pm", "Tomorrow 6:30pm", "Friday 11am". */
export function friendlyTime(iso: string, now = new Date()) {
  return `${dayLabel(iso, now)} ${clock(new Date(iso))}`;
}

/** DESIGN.md: expired = starts_at < now(); calculated, never stored. */
export function isExpired(iso: string, now = new Date()) {
  return new Date(iso).getTime() < now.getTime();
}

export function isThisWeek(iso: string, now = new Date()) {
  const t = new Date(iso).getTime();
  return t >= now.getTime() && t < startOfDay(now).getTime() + 7 * DAY;
}

export function priceLabel(min: number | null, max: number | null) {
  if (min === null && max === null) return 'Price TBA';
  if (min === 0 && max === 0) return 'Free';
  if (min !== null && max !== null && min !== max) return `$${min}–$${max}`;
  return `$${min ?? max}`;
}

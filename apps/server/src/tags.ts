export const TAGS = [
  "music",
  "nightlife",
  "food",
  "drinks",
  "art",
  "theater",
  "comedy",
  "film",
  "sports",
  "fitness",
  "outdoors",
  "tech",
  "career",
  "networking",
  "academic",
  "workshop",
  "community",
  "volunteering",
  "gaming",
  "wellness",
] as const;

export type Tag = (typeof TAGS)[number];

const TAG_SET: ReadonlySet<string> = new Set(TAGS);

export function isTag(value: string): value is Tag {
  return TAG_SET.has(value);
}

import { HTTP } from "./config.js";
import { DEFAULT_IMAGES, type DefaultImage } from "./defaultImages.js";
import type { HttpClient, Logger, SourceEvent } from "./types.js";
import type { Tag } from "../tags.js";

const TRUSTED_HOSTS = new Set(["media.thebostoncalendar.com"]);
const BAD_IMAGE = /(logo|favicon|placeholder|default|blank|spacer|sprite|icon)|\.(svg|gif)$/i;

const hostOf = (url: string): string | null => {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
};
const isNoFetch = (url: string) => HTTP.noFetchHosts.includes(hostOf(url) ?? "");

function isBadImageUrl(url: string): boolean {
  try {
    const { pathname } = new URL(url);
    return BAD_IMAGE.test(decodeURIComponent(pathname));
  } catch {
    return true;
  }
}

/** True when the URL is usable as an event photo. */
async function isGoodImage(url: string, http: HttpClient): Promise<boolean> {
  if (isBadImageUrl(url)) return false;
  if (TRUSTED_HOSTS.has(new URL(url).host)) return true;
  if (isNoFetch(url)) return false;
  return ((await http.contentType(url)) ?? "").startsWith("image/");
}

function attr(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"));
  return match ? (match[1] ?? match[2]) : null;
}

const decodeAmp = (text: string) => text.replace(/&amp;/g, "&");

/** The og:image / twitter:image URL of a page, resolved against the page URL. */
export function findPageImage(html: string, pageUrl: string): string | null {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = (attr(tag, "property") ?? attr(tag, "name") ?? "").toLowerCase();
    if (key !== "og:image" && key !== "twitter:image") continue;
    const content = attr(tag, "content")?.trim();
    if (!content) continue;
    try {
      return new URL(decodeAmp(content), pageUrl).href;
    } catch {
      // unparsable URL: keep looking
    }
  }
  return null;
}

async function resolveOne(event: SourceEvent, http: HttpClient): Promise<string | null> {
  if (event.imageUrl && (await isGoodImage(event.imageUrl, http))) return event.imageUrl;
  if (isNoFetch(event.sourceUrl)) return null;
  const page = findPageImage(await http.getText(event.sourceUrl), event.sourceUrl);
  return page && (await isGoodImage(page, http)) ? page : null;
}

export async function resolveImages(events: SourceEvent[], http: HttpClient, log: Logger = () => {}): Promise<SourceEvent[]> {
  const result: SourceEvent[] = [];
  for (const event of events) {
    let imageUrl: string | null = null;
    try {
      imageUrl = await resolveOne(event, http);
    } catch (error) {
      log(`image lookup failed for "${event.title}": ${(error as Error).message}`);
    }
    result.push({ ...event, imageUrl });
  }
  return result;
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function pickDefaultImage(tags: readonly Tag[], id: string): DefaultImage {
  const byTag = tags.map((tag) => DEFAULT_IMAGES.filter((image) => image.tags.includes(tag))).find((c) => c.length > 0);
  const generic = DEFAULT_IMAGES.filter((image) => image.tags.length === 0);
  const candidates = byTag ?? (generic.length > 0 ? generic : DEFAULT_IMAGES);
  return candidates[hash(id) % candidates.length];
}

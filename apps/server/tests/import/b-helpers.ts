import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { HttpClient, SourceContext } from "../../src/import/types.js";

export const fixture = (name: string) => readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf8");

/** Serves fixtures by URL. `routes` maps a URL prefix to fixture file; no network, ever. */
export function fakeHttp(routes: Record<string, string>, requested: string[] = []): HttpClient {
  const find = (url: string) => {
    requested.push(url);
    const key = Object.keys(routes).filter((k) => url.startsWith(k)).sort((a, b) => b.length - a.length)[0];
    if (!key) throw new Error(`no fixture for ${url}`);
    return fixture(routes[key]);
  };
  return {
    getText: async (url) => find(url),
    getJson: async <T>(url: string) => JSON.parse(find(url)) as T,
    contentType: async () => "image/jpeg",
  };
}

export const WINDOW = { start: new Date("2026-11-20T05:00:00Z"), end: new Date("2026-12-01T05:00:00Z") };

export function ctxFor(http: HttpClient, window = WINDOW, logs: string[] = []): SourceContext {
  return { http, window, log: (m) => logs.push(m) };
}

export function expectSane(events: { title: string; startsAt: string; sourceUrl: string }[]) {
  for (const e of events) {
    if (!e.title.trim()) throw new Error("empty title");
    if (!/[+-]0[45]:00$/.test(e.startsAt)) throw new Error(`not NY offset: ${e.startsAt}`);
    new URL(e.sourceUrl);
  }
}

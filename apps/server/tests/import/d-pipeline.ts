import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createGeocoder } from "../../src/import/geocode.js";
import { createBostonCalendarSource } from "../../src/import/sources/bostonCalendar.js";
import { runFetch } from "../../src/import/stages/fetch.js";
import type { HttpClient, RawEvent } from "../../src/import/types.js";
import { fakeHttp } from "./b-helpers.js";

export const ROUTES: Record<string, string> = {
  "https://www.eventbrite.com/d/ma--boston/events--this-week/": "eventbrite_list.html",
  "https://do617.com/events": "do617_list.html",
  "https://calendar.northeastern.edu/api/2/events": "northeastern.json",
  "https://calendar.mit.edu/api/2/events": "mit.json",
  "https://events.college.harvard.edu/live/json/events": "harvard.json",
  "https://www.bu.edu/calendar/rpc/events.json.php": "bu_day.json",
  "https://www.bu.edu/calendar/rpc/event.json.php": "bu_detail.json",
};
const BOSTON_FILE = fileURLToPath(new URL("./fixtures/bostoncalendar_small.json", import.meta.url));

/** Fixture HTTP; pages with no fixture (event detail pages for og:image) return empty html. */
export function pipelineHttp(): HttpClient {
  const base = fakeHttp(ROUTES);
  return { ...base, getText: async (url) => base.getText(url).catch(() => "<html></html>") };
}

/** Runs the real runFetch with fixture HTTP, an offline geocoder and the small Boston Calendar file. */
export async function composeFetch(now: Date, outPath: string, cachePath: string): Promise<RawEvent[]> {
  const geocoder = createGeocoder({
    cachePath,
    fetchFn: (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch,
    sleep: async () => {},
  });
  await runFetch({
    now,
    log: () => {},
    sources: ["thebostoncalendar", "eventbrite", "do617", "northeastern", "mit", "harvard", "bu"],
    paths: { raw: outPath },
    http: pipelineHttp(),
    geocoder,
    sourceOverrides: [createBostonCalendarSource(BOSTON_FILE)],
  });
  return JSON.parse(await readFile(outPath, "utf8")) as RawEvent[];
}

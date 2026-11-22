import { mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createGeocoder, fillCoordinates, type Geocoder } from "../../src/import/geocode.js";
import { ev } from "./a-fixtures.js";

const dir = fileURLToPath(new URL("../../data/test-tmp-a-geocode", import.meta.url));
const cachePath = join(dir, "geo.json");
beforeEach(async () => {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
});
afterEach(() => rm(dir, { recursive: true, force: true }));

function fakeFetch(body: unknown, status = 200) {
  const urls: { url: string; ua: string | null }[] = [];
  const fn = (async (url: string, init?: RequestInit) => {
    urls.push({ url, ua: new Headers(init?.headers).get("user-agent") });
    if (body instanceof Error) throw body;
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { fn, urls };
}
const sleep = async () => {};

describe("createGeocoder", () => {
  it("queries Nominatim with params, caches hits, persists on save", async () => {
    const { fn, urls } = fakeFetch([{ lat: "42.35", lon: "-71.06" }]);
    const g = createGeocoder({ cachePath, fetchFn: fn, sleep });
    expect(await g.geocode("1 Main St, Boston")).toEqual({ lat: 42.35, lng: -71.06 });
    expect(await g.geocode("  1  MAIN st, boston ")).toEqual({ lat: 42.35, lng: -71.06 });
    expect(urls).toHaveLength(1);
    const u = new URL(urls[0].url);
    expect(u.searchParams.get("q")).toBe("1 Main St, Boston");
    expect(u.searchParams.get("format")).toBe("jsonv2");
    expect(u.searchParams.get("limit")).toBe("1");
    expect(u.searchParams.get("countrycodes")).toBe("us");
    expect(u.searchParams.get("bounded")).toBe("1");
    expect(urls[0].ua).toBe("WheahsItAt-EventImporter/0.1");
    await g.save();
    expect(JSON.parse(await readFile(cachePath, "utf8"))["1 main st, boston"]).toEqual({ lat: 42.35, lng: -71.06 });
  });

  it("caches misses (null), including across instances via the file", async () => {
    const { fn, urls } = fakeFetch([]);
    const g = createGeocoder({ cachePath, fetchFn: fn, sleep });
    expect(await g.geocode("nowhere")).toBeNull();
    expect(await g.geocode("nowhere")).toBeNull();
    expect(urls).toHaveLength(1);
    await g.save();
    const second = fakeFetch([{ lat: "42.35", lon: "-71.06" }]);
    const g2 = createGeocoder({ cachePath, fetchFn: second.fn, sleep });
    expect(await g2.geocode("nowhere")).toBeNull();
    expect(second.urls).toHaveLength(0);
  });

  it("rejects results outside the Boston box (and caches that as a miss)", async () => {
    const { fn, urls } = fakeFetch([{ lat: "40.71", lon: "-74.0" }]);
    const g = createGeocoder({ cachePath, fetchFn: fn, sleep });
    expect(await g.geocode("Broadway")).toBeNull();
    expect(await g.geocode("Broadway")).toBeNull();
    expect(urls).toHaveLength(1);
  });

  it("returns null and does not cache on network error or HTTP error", async () => {
    const logs: string[] = [];
    const bad = fakeFetch(new Error("offline"));
    const g = createGeocoder({ cachePath, fetchFn: bad.fn, sleep, log: (m) => logs.push(m) });
    expect(await g.geocode("x")).toBeNull();
    expect(await g.geocode("x")).toBeNull();
    expect(bad.urls).toHaveLength(2);
    expect(logs.length).toBeGreaterThan(0);
    const http500 = fakeFetch({}, 500);
    const g2 = createGeocoder({ cachePath, fetchFn: http500.fn, sleep });
    expect(await g2.geocode("y")).toBeNull();
    await g2.save();
    await expect(readFile(cachePath, "utf8")).rejects.toThrow(); // nothing cacheable -> no file
  });

  it("waits delayMs between requests", async () => {
    const waits: number[] = [];
    const { fn } = fakeFetch([]);
    const g = createGeocoder({ cachePath, fetchFn: fn, sleep: async (ms) => void waits.push(ms) });
    await g.geocode("a");
    await g.geocode("b");
    expect(waits.length).toBeGreaterThanOrEqual(1);
    expect(waits[0]).toBeGreaterThan(0);
  });
});

describe("fillCoordinates", () => {
  const stub = (point: { lat: number; lng: number } | null) => {
    const queries: string[] = [];
    const g: Geocoder = { geocode: async (q) => (queries.push(q), point), locate: async () => null, save: async () => {} };
    return { g, queries };
  };

  it("geocodes only events missing coordinates, appends city, prefers address, does not mutate", async () => {
    const { g, queries } = stub({ lat: 42.3, lng: -71.1 });
    const has = ev({ lat: 1, lng: 2, location: "Somewhere" });
    const needs = ev({ location: "Cafe X", address: "1 Main St", sourceUrl: "https://x.com/2" });
    const input = [has, needs];
    const out = await fillCoordinates(input, g);
    expect(queries).toEqual(["1 Main St, Boston, MA"]);
    expect(out[0]).toEqual(has);
    expect(out[1]).toMatchObject({ lat: 42.3, lng: -71.1 });
    expect(needs.lat).toBeNull();
  });

  it("does not append city when one is present; fills when only one coord is null", async () => {
    const { g, queries } = stub({ lat: 42.3, lng: -71.1 });
    const out = await fillCoordinates([ev({ address: "5 Oak St, Cambridge, MA", lat: 42.1, lng: null })], g);
    expect(queries).toEqual(["5 Oak St, Cambridge, MA"]);
    expect(out[0]).toMatchObject({ lat: 42.3, lng: -71.1 });
  });

  it("skips events with no place or a generic one, and leaves misses null", async () => {
    const { g, queries } = stub(null);
    const out = await fillCoordinates([ev(), ev({ location: "TBA" }), ev({ location: "Boston" }), ev({ location: "Cafe X" })], g);
    expect(queries).toEqual(["Cafe X, Boston, MA"]);
    expect(out.every((e) => e.lat === null)).toBe(true);
  });

  it("uses the source's city, skips it when the text has a city or ZIP, and falls back to location", async () => {
    const queries: string[] = [];
    const g: Geocoder = { geocode: async (q) => (queries.push(q), q.startsWith("Kresge Oval") ? { lat: 42.3, lng: -71.1 } : null), locate: async () => null, save: async () => {} };
    const out = await fillCoordinates(
      [
        ev({ source: "mit", location: "Kresge Oval", address: "77 Mass Ave Bldg 9", sourceUrl: "https://x.com/1" }),
        ev({ source: "harvard", location: "Smith Campus Center", sourceUrl: "https://x.com/2" }),
        ev({ source: "bu", address: "1 Main St 02215", sourceUrl: "https://x.com/3" }),
        ev({ source: "do617", location: "Cafe X, Somerville", sourceUrl: "https://x.com/4" }),
      ],
      g,
    );
    expect(queries).toEqual([
      "77 Mass Ave Bldg 9, Cambridge, MA",
      "Kresge Oval, Cambridge, MA",
      "Smith Campus Center, Cambridge, MA",
      "1 Main St 02215",
      "Cafe X, Somerville",
    ]);
    expect(out[0].lat).toBe(42.3);
    expect(out[1].lat).toBeNull();
  });
});

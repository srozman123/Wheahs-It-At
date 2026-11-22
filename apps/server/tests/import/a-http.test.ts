import { mkdir, rm, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHttpClient } from "../../src/import/http.js";

const dir = fileURLToPath(new URL("../../data/test-tmp-a-http", import.meta.url));

type Call = { url: string; method: string; ua: string | null };
function fakeFetch(routes: Record<string, () => Response>) {
  const calls: Call[] = [];
  const fn = (async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    calls.push({ url, method, ua: new Headers(init?.headers).get("user-agent") });
    const route = routes[`${method} ${url}`] ?? routes[url];
    if (!route) return new Response("not found", { status: 404 });
    return route();
  }) as unknown as typeof fetch;
  return { fn, calls };
}
const noSleep = async () => {};

beforeEach(async () => {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
});
afterEach(() => rm(dir, { recursive: true, force: true }));

describe("createHttpClient", () => {
  it("sends the user agent, returns text/json, and caches 2xx responses", async () => {
    const { fn, calls } = fakeFetch({ "https://a.test/x": () => new Response('{"n":1}') });
    const http = createHttpClient({ cacheDir: dir, fetchFn: fn, sleep: noSleep });
    expect(await http.getJson("https://a.test/x")).toEqual({ n: 1 });
    expect(await http.getText("https://a.test/x")).toBe('{"n":1}');
    const page = calls.filter((c) => c.url === "https://a.test/x");
    expect(page).toHaveLength(1);
    expect(page[0].ua).toContain("Mozilla");
    expect(await readdir(dir)).toHaveLength(1);
  });

  it("refetches once the cache is older than the TTL", async () => {
    const { fn, calls } = fakeFetch({ "https://a.test/x": () => new Response("hi") });
    await createHttpClient({ cacheDir: dir, fetchFn: fn, sleep: noSleep }).getText("https://a.test/x");
    const later = createHttpClient({ cacheDir: dir, fetchFn: fn, sleep: noSleep, now: () => Date.now() + 4 * 3600_000 });
    await later.getText("https://a.test/x");
    expect(calls.filter((c) => c.url === "https://a.test/x")).toHaveLength(2);
  });

  it("throws with status and url on non-2xx and does not cache it", async () => {
    const { fn } = fakeFetch({ "https://a.test/x": () => new Response("no", { status: 500 }) });
    const http = createHttpClient({ cacheDir: dir, fetchFn: fn, sleep: noSleep });
    await expect(http.getText("https://a.test/x")).rejects.toThrow(/500.*https:\/\/a\.test\/x/);
    expect(await readdir(dir)).toHaveLength(0);
  });

  it("throws on invalid JSON", async () => {
    const { fn } = fakeFetch({ "https://a.test/x": () => new Response("<html>") });
    await expect(createHttpClient({ cacheDir: dir, fetchFn: fn, sleep: noSleep }).getJson("https://a.test/x")).rejects.toThrow(/JSON/);
  });

  it("respects robots.txt Disallow (longest match wins) and fetches robots once per host", async () => {
    const robots = "User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nDisallow: /private\nAllow: /private/ok\n";
    const { fn, calls } = fakeFetch({
      "https://a.test/robots.txt": () => new Response(robots),
      "https://a.test/private/ok": () => new Response("fine"),
      "https://a.test/public": () => new Response("fine"),
    });
    const http = createHttpClient({ cacheDir: dir, fetchFn: fn, sleep: noSleep });
    await expect(http.getText("https://a.test/private/secret")).rejects.toThrow(/robots\.txt/);
    expect(await http.getText("https://a.test/private/ok")).toBe("fine");
    expect(await http.getText("https://a.test/public")).toBe("fine");
    expect(calls.filter((c) => c.url.endsWith("robots.txt"))).toHaveLength(1);
  });

  it("allows everything when robots.txt is missing", async () => {
    const { fn } = fakeFetch({ "https://a.test/p": () => new Response("ok") });
    expect(await createHttpClient({ cacheDir: dir, fetchFn: fn, sleep: noSleep }).getText("https://a.test/p")).toBe("ok");
  });

  it("waits perHostDelayMs between requests to the same host only", async () => {
    const waits: number[] = [];
    const { fn } = fakeFetch({ "https://a.test/1": () => new Response("1"), "https://b.test/1": () => new Response("1") });
    const http = createHttpClient({ cacheDir: dir, fetchFn: fn, sleep: async (ms) => void waits.push(ms), now: () => 1_000_000 });
    await http.getText("https://a.test/1");
    expect(waits).toHaveLength(1); // robots.txt then page on a.test
    await http.getText("https://b.test/1");
    expect(waits).toHaveLength(2); // b.test: only its own robots -> page gap
  });

  describe("contentType", () => {
    it("returns lowercase media type without params, via HEAD, memoized", async () => {
      const { fn, calls } = fakeFetch({ "HEAD https://a.test/i.jpg": () => new Response(null, { headers: { "content-type": "Image/JPEG; charset=x" } }) });
      const http = createHttpClient({ cacheDir: dir, fetchFn: fn, sleep: noSleep });
      expect(await http.contentType("https://a.test/i.jpg")).toBe("image/jpeg");
      expect(await http.contentType("https://a.test/i.jpg")).toBe("image/jpeg");
      expect(calls.filter((c) => c.url.endsWith("i.jpg"))).toHaveLength(1);
    });

    it("falls back to GET on 405/403 and returns null on failure", async () => {
      const { fn, calls } = fakeFetch({
        "HEAD https://a.test/i.png": () => new Response(null, { status: 405 }),
        "GET https://a.test/i.png": () => new Response("x", { headers: { "content-type": "image/png" } }),
      });
      const http = createHttpClient({ cacheDir: dir, fetchFn: fn, sleep: noSleep });
      expect(await http.contentType("https://a.test/i.png")).toBe("image/png");
      expect(calls.some((c) => c.method === "GET" && c.url.endsWith("i.png"))).toBe(true);
      expect(await http.contentType("https://a.test/missing")).toBeNull();
    });

    it("returns null when fetch throws", async () => {
      const fn = (async () => {
        throw new Error("network");
      }) as unknown as typeof fetch;
      expect(await createHttpClient({ cacheDir: dir, fetchFn: fn, sleep: noSleep }).contentType("https://a.test/x")).toBeNull();
    });
  });
});

import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { HTTP, PATHS } from "./config.js";
import type { HttpClient, Logger } from "./types.js";

type Options = {
  cacheDir?: string;
  log?: Logger;
  fetchFn?: typeof fetch;
  now?: () => number;
  /** Injectable so tests don't really wait out the per-host delay. */
  sleep?: (ms: number) => Promise<void>;
};

type RobotRule = { allow: boolean; pattern: RegExp; length: number };

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Rules of the `User-agent: *` group (groups with several agents count if any is `*`). */
export function parseRobots(text: string): RobotRule[] {
  const rules: RobotRule[] = [];
  let groupAgents: string[] = [];
  let sawRule = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const field = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (field === "user-agent") {
      if (sawRule) groupAgents = [];
      sawRule = false;
      groupAgents.push(value.toLowerCase());
    } else if ((field === "allow" || field === "disallow") && groupAgents.includes("*")) {
      sawRule = true;
      if (value) rules.push({ allow: field === "allow", pattern: robotPattern(value), length: value.length });
    } else if (field === "allow" || field === "disallow") {
      sawRule = true;
    }
  }
  return rules;
}

function robotPattern(path: string): RegExp {
  const escaped = path.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}`);
}

export function robotsAllows(rules: RobotRule[], pathAndQuery: string): boolean {
  let best: RobotRule | undefined;
  for (const rule of rules) {
    if (!rule.pattern.test(pathAndQuery)) continue;
    if (!best || rule.length > best.length || (rule.length === best.length && rule.allow)) best = rule;
  }
  return best ? best.allow : true;
}

export function createHttpClient(opts: Options = {}): HttpClient {
  const cacheDir = opts.cacheDir ?? PATHS.httpCache;
  const log = opts.log ?? (() => {});
  const fetchFn = opts.fetchFn ?? fetch;
  const now = opts.now ?? Date.now;
  const sleep = opts.sleep ?? realSleep;

  const hostQueue = new Map<string, Promise<unknown>>();
  const lastRequestAt = new Map<string, number>();
  const robotsByHost = new Map<string, Promise<RobotRule[]>>();
  const contentTypes = new Map<string, Promise<string | null>>();

  /** Runs `task` after earlier tasks for the same host, at least perHostDelayMs after the previous request. */
  function perHost<T>(host: string, task: () => Promise<T>): Promise<T> {
    const run = (hostQueue.get(host) ?? Promise.resolve()).then(async () => {
      const last = lastRequestAt.get(host);
      if (last !== undefined) {
        const wait = last + HTTP.perHostDelayMs - now();
        if (wait > 0) await sleep(wait);
      }
      try {
        return await task();
      } finally {
        lastRequestAt.set(host, now());
      }
    });
    hostQueue.set(host, run.catch(() => undefined));
    return run;
  }

  function request(url: string, method: "GET" | "HEAD"): Promise<Response> {
    const host = new URL(url).host;
    return perHost(host, () =>
      fetchFn(url, {
        method,
        headers: { "user-agent": HTTP.userAgent },
        signal: AbortSignal.timeout(HTTP.timeoutMs),
      }),
    );
  }

  function loadRobots(url: URL): Promise<RobotRule[]> {
    let cached = robotsByHost.get(url.host);
    if (!cached) {
      cached = (async () => {
        try {
          const response = await request(`${url.protocol}//${url.host}/robots.txt`, "GET");
          return response.ok ? parseRobots(await response.text()) : [];
        } catch (error) {
          log(`robots.txt for ${url.host} failed to load (${(error as Error).message}); allowing`);
          return [];
        }
      })();
      robotsByHost.set(url.host, cached);
    }
    return cached;
  }

  async function assertAllowed(url: string): Promise<void> {
    if (!HTTP.respectRobotsTxt) return;
    const parsed = new URL(url);
    if (!robotsAllows(await loadRobots(parsed), parsed.pathname + parsed.search)) {
      throw new Error(`Blocked by robots.txt: ${url}`);
    }
  }

  const cachePath = (url: string) => join(cacheDir, createHash("sha256").update(url).digest("hex"));

  async function readCache(url: string): Promise<string | null> {
    try {
      const path = cachePath(url);
      const { mtimeMs } = await stat(path);
      if (now() - mtimeMs >= HTTP.cacheTtlMs) return null;
      return await readFile(path, "utf8");
    } catch {
      return null;
    }
  }

  async function getText(url: string): Promise<string> {
    const cached = await readCache(url);
    if (cached !== null) return cached;
    await assertAllowed(url);
    const response = await request(url, "GET");
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    const text = await response.text();
    await mkdir(cacheDir, { recursive: true });
    await writeFile(cachePath(url), text, "utf8");
    return text;
  }

  async function getJson<T = unknown>(url: string): Promise<T> {
    const text = await getText(url);
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(`Invalid JSON from ${url}`);
    }
  }

  const mediaType = (response: Response) =>
    (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase() || null;

  async function probeContentType(url: string): Promise<string | null> {
    try {
      await assertAllowed(url);
      let response = await request(url, "HEAD").catch(() => null);
      if (!response || response.status === 405 || response.status === 403) response = await request(url, "GET");
      if (!response.ok) return null;
      const type = mediaType(response);
      // A GET body we don't need; release the connection.
      if (response.body && !response.bodyUsed) await response.body.cancel().catch(() => {});
      return type;
    } catch {
      return null;
    }
  }

  function contentType(url: string): Promise<string | null> {
    let known = contentTypes.get(url);
    if (!known) {
      known = probeContentType(url);
      contentTypes.set(url, known);
    }
    return known;
  }

  return { getText, getJson, contentType };
}

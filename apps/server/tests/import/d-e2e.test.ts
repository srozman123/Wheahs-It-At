import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getPool } from "../../src/db/pool.js";
import { writeJson } from "../../src/import/io.js";
import { runClear } from "../../src/import/stages/clear.js";
import { runNormalize } from "../../src/import/stages/normalize.js";
import { runSave } from "../../src/import/stages/save.js";
import { RawEventSchema } from "../../src/import/types.js";
import type { RawEvent } from "../../src/import/types.js";
import { TAGS } from "../../src/tags.js";
import { describeDb, insertEvent, insertUser, resetDb } from "../helpers.js";
import { composeFetch } from "./d-pipeline.js";

const serverDir = fileURLToPath(new URL("../..", import.meta.url));
const dir = join(serverDir, `data/test-tmp-d-${process.pid}`);
const paths = { raw: join(dir, "raw.json"), tags: join(dir, "tags.json") };
const cache = join(dir, "geocode.json");
const NOW = new Date("2026-11-21T12:00:00-05:00");
const silent = () => {};

beforeEach(() => mkdir(dir, { recursive: true }));
afterEach(() => rm(dir, { recursive: true, force: true }));

const readRaw = async () => JSON.parse(await readFile(paths.raw, "utf8")) as RawEvent[];

function ev(n: number): RawEvent {
  return {
    id: n.toString(16).padStart(16, "0"), source: "test", title: `Event ${n}`, description: null,
    startsAt: "2026-11-22T19:30:00-05:00", location: "Somewhere", address: null, lat: 42.3, lng: -71.1,
    imageUrl: null, sourceUrl: `https://example.com/d/${n}`, priceMin: null, priceMax: null, hints: [],
  };
}

describe("fetch (real runFetch with fixture HTTP)", () => {
  it("produces a valid, unique, sorted, in-window, in-person raw file", async () => {
    const raw = await composeFetch(NOW, paths.raw, cache);
    expect(raw.length).toBeGreaterThan(10);
    const onDisk = await readRaw();
    for (const e of onDisk) RawEventSchema.parse(e);
    expect(new Set(onDisk.map((e) => e.id)).size).toBe(onDisk.length);
    const times = onDisk.map((e) => new Date(e.startsAt).getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
    for (const t of times) {
      expect(t).toBeGreaterThanOrEqual(NOW.getTime());
      expect(t).toBeLessThanOrEqual(NOW.getTime() + 7 * 86400_000);
    }
    for (const e of onDisk) expect(`${e.location} ${e.address}`).not.toMatch(/\b(online|virtual|zoom|webinar)\b/i);
    expect(new Set(onDisk.map((e) => e.source)).size).toBeGreaterThan(3);
  });

  it("no webinar/zoom/virtual in titles of kept events", async () => {
    const raw = await composeFetch(NOW, paths.raw, cache);
    for (const e of raw) expect(e.title).not.toMatch(/\b(online|virtual|zoom|webinar)\b/i);
  });

  it("keeps ids stable across re-fetches with different `now` inside the week", async () => {
    const a = await composeFetch(new Date("2026-11-21T12:00:00-05:00"), paths.raw, cache);
    const b = await composeFetch(new Date("2026-11-21T18:00:00-05:00"), join(dir, "raw2.json"), cache);
    const idsB = new Set(b.map((e) => e.id));
    const overlap = a.filter((e) => idsB.has(e.id));
    expect(overlap.length).toBeGreaterThan(5);
    const startedBeforeB = a.filter((e) => new Date(e.startsAt) >= new Date("2026-11-21T18:00:00-05:00") && new Date(e.startsAt) <= new Date("2026-11-28T12:00:00-05:00"));
    // every event in both windows must appear in both runs under the same id
    for (const e of startedBeforeB) expect(idsB.has(e.id), `${e.title} lost its id`).toBe(true);
  });
});

describeDb("full pipeline with DB", () => {
  beforeEach(resetDb);

  it("fetch -> tag -> dry run -> save -> resave -> clear", async () => {
    const raw = await composeFetch(NOW, paths.raw, cache);
    const upcoming = raw.length;
    const tagged = raw.slice(0, raw.length - 3); // leave 3 untagged
    await writeJson(paths.tags, tagged.map((e, i) => ({ id: e.id, description: `Annotated ${i}`, tags: [TAGS[i % TAGS.length]] })));

    const seedId = (await getPool().query(`INSERT INTO events (title, tags, starts_at, source_url) VALUES ('Seed', ARRAY['music'], $1, 'seed://x') RETURNING id`, [new Date(NOW.getTime() + 86400_000)])).rows[0].id;
    const userId = await insertUser("Poster");
    const userEvent = await insertEvent({ startsAt: new Date(NOW.getTime() + 86400_000), title: "Mine" });
    await getPool().query("UPDATE events SET creator_id = $1 WHERE id = $2", [userId, userEvent]);

    const dry = await runSave({ dryRun: true, now: NOW, log: silent, paths });
    expect(dry).toMatchObject({ inserted: 0, untagged: 3 });
    const count = async () => Number((await getPool().query("SELECT count(*) FROM events WHERE source_url NOT LIKE 'seed://%' OR source_url IS NULL")).rows[0].count);
    expect(await count()).toBe(1); // only the user event; dry run wrote nothing

    const res = await runSave({ now: NOW, log: silent, paths });
    expect(res.inserted).toBe(tagged.length);
    expect(res.untagged).toBe(3);
    expect(upcoming).toBeGreaterThan(res.inserted);

    const { rows } = await getPool().query("SELECT * FROM events WHERE source_url IS NOT NULL AND source_url NOT LIKE 'seed://%'");
    expect(rows).toHaveLength(tagged.length);
    for (const r of rows) {
      expect(r.creator_id).toBeNull();
      expect(r.image_url).toBeTruthy();
      expect(r.description).toMatch(/^Annotated \d+$/);
      for (const t of r.tags) expect(TAGS as readonly string[]).toContain(t);
    }

    expect((await runSave({ now: NOW, log: silent, paths })).inserted).toBe(0);

    expect(await runClear({ yes: true, log: silent })).toBe(tagged.length);
    const left = (await getPool().query("SELECT id FROM events")).rows.map((r) => r.id).sort();
    expect(left).toEqual([seedId, userEvent].sort());
  });
});

describe("stage contract edge cases", () => {
  it("ignores unknown ids in the tags file on save", async () => {
    await writeJson(paths.raw, [ev(1)]);
    await writeJson(paths.tags, [{ id: ev(1).id, description: "ok", tags: ["music"] }, { id: "f".repeat(16), description: "ghost", tags: ["art"] }]);
    expect(await runSave({ dryRun: true, now: NOW, log: silent, paths })).toMatchObject({ untagged: 0, expired: 0 });
  });

  it("skips and logs an invalid tag entry (with its index), saving the rest", async () => {
    await writeJson(paths.raw, [ev(1), ev(2)]);
    await writeJson(paths.tags, [{ id: ev(1).id, description: "ok", tags: ["music"] }, { id: ev(2).id, description: "bad", tags: ["not-a-tag"] }]);
    const logs: string[] = [];
    const res = await runSave({ dryRun: true, now: NOW, log: (m) => logs.push(m), paths });
    expect(res).toMatchObject({ untagged: 1 }); // event 2 is not saved
    const out = logs.join("\n");
    expect(out).toMatch(/1 invalid entries in events_tags\.json skipped/);
    expect(out).toMatch(/entry 1:.*tags/);
    expect(out).toContain("Event 2"); // listed as untagged
    expect(out).toContain('"title": "Event 1"'); // sample of what would be saved
  });

  it("reports malformed JSON clearly", async () => {
    await writeJson(paths.raw, [ev(1)]);
    const { writeFile } = await import("node:fs/promises");
    await writeFile(paths.tags, "[{oops", "utf8");
    await expect(runSave({ dryRun: true, now: NOW, log: silent, paths })).rejects.toThrow(/Can't read .*tags\.json/);
  });

  it("missing raw file: clear error", async () => {
    await expect(runSave({ dryRun: true, log: silent, paths })).rejects.toThrow(/raw\.json: file not found/);
    await expect(runNormalize({ log: silent, paths })).rejects.toThrow(/raw\.json: file not found/);
  });

  it("missing tags file on save points at the normalize step / manual tagging", async () => {
    await writeJson(paths.raw, [ev(1)]);
    await expect(runSave({ dryRun: true, now: NOW, log: silent, paths })).rejects.toThrow(/No tags file at .*tags\.json\. Tag the events first: npm run import:normalize/);
  });
});

describe("resumability", () => {
  it("keeps batch 1 on RateLimitError, then a good client tags only the rest", async () => {
    const events = [ev(1), ev(2), ev(3), ev(4)];
    await writeJson(paths.raw, events);
    let calls = 0;
    const bad = { messages: { parse: async (p: any) => {
      calls++;
      if (calls === 2) throw new Anthropic.RateLimitError(429, {}, "slow down", new Headers());
      const ids = p.messages[0].content.split("\n").map((l: string) => JSON.parse(l).id);
      return { stop_reason: "end_turn", parsed_output: { events: ids.map((id: string) => ({ id, description: "d", tags: ["music"] })) } };
    } } } as unknown as Anthropic;
    const first = await runNormalize({ client: bad, batchSize: 2, log: silent, paths });
    expect(first).toEqual({ tagged: 2, remaining: 2 });
    const onDisk = JSON.parse(await readFile(paths.tags, "utf8"));
    expect(onDisk.map((a: any) => a.id)).toEqual([events[0].id, events[1].id]);

    const seen: string[] = [];
    const good = { messages: { parse: async (p: any) => {
      const ids = p.messages[0].content.split("\n").map((l: string) => JSON.parse(l).id);
      seen.push(...ids);
      return { stop_reason: "end_turn", parsed_output: { events: ids.map((id: string) => ({ id, description: "d", tags: ["art"] })) } };
    } } } as unknown as Anthropic;
    expect(await runNormalize({ client: good, batchSize: 2, log: silent, paths })).toEqual({ tagged: 4, remaining: 0 });
    expect(seen).toEqual([events[2].id, events[3].id]);
  });
});

describe("CLI smoke", () => {
  const run = (args: string[]) => {
    const env = { ...process.env };
    delete env.DATABASE_URL;
    return spawnSync("npx", ["tsx", "src/import/cli.ts", ...args], { cwd: serverDir, env, encoding: "utf8", timeout: 60_000 });
  };
  it("no args -> exit 1 + usage", () => {
    const r = run([]);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/Usage:/);
  });
  it("bogus stage -> exit 1 + usage", () => {
    const r = run(["bogus"]);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/Usage:/);
  });
  it("clear without --yes -> exit 0, no DB needed", () => {
    const r = run(["clear"]);
    expect(r.stderr).not.toMatch(/DATABASE_URL/);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/--yes/);
  });
});

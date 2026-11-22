import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type Anthropic from "@anthropic-ai/sdk";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getPool } from "../../src/db/pool.js";
import { writeJson } from "../../src/import/io.js";
import { runNormalize } from "../../src/import/stages/normalize.js";
import { runSave } from "../../src/import/stages/save.js";
import { runClear } from "../../src/import/stages/clear.js";
import type { RawEvent } from "../../src/import/types.js";
import { describeDb, resetDb } from "../helpers.js";

const serverDir = fileURLToPath(new URL("../..", import.meta.url));
const dir = join(serverDir, `data/test-tmp-c-${process.pid}`);
const paths = { raw: join(dir, "raw.json"), tags: join(dir, "tags.json") };
const NOW = new Date("2026-11-21T12:00:00-05:00");

function ev(n: number, extra: Partial<RawEvent> = {}): RawEvent {
  return {
    id: n.toString(16).padStart(16, "0"),
    source: "test",
    title: `Event ${n}`,
    description: "Source description",
    startsAt: "2026-11-22T19:30:00-05:00",
    location: "Somewhere",
    address: null,
    lat: 42.3,
    lng: -71.1,
    imageUrl: null,
    sourceUrl: `https://example.com/c/${n}`,
    priceMin: null,
    priceMax: null,
    hints: [],
    ...extra,
  };
}

beforeEach(() => mkdir(dir, { recursive: true }));
afterEach(() => rm(dir, { recursive: true, force: true }));

function fake(tagged: string[]) {
  return {
    messages: {
      parse: async (params: any) => {
        const ids = params.messages[0].content.split("\n").map((l: string) => JSON.parse(l).id);
        tagged.push(...ids);
        return { stop_reason: "end_turn", parsed_output: { events: ids.map((id: string) => ({ id, description: "Tidy.", tags: ["music"] })) } };
      },
    },
  } as unknown as Anthropic;
}

describe("runNormalize", () => {
  it("is resumable and only tags untagged events", async () => {
    await writeJson(paths.raw, [ev(1), ev(2), ev(3)]);
    await writeJson(paths.tags, [
      { id: ev(1).id, description: "Old", tags: ["art"] },
      { id: "f".repeat(16), description: "Stale", tags: ["art"] },
    ]);
    const tagged: string[] = [];
    const logs: string[] = [];
    const res = await runNormalize({ client: fake(tagged), log: (m) => logs.push(m), paths });
    expect(res).toEqual({ tagged: 3, remaining: 0 });
    expect(tagged.sort()).toEqual([ev(2).id, ev(3).id]);
    const saved = JSON.parse(await readFile(paths.tags, "utf8"));
    // the annotation for an event that's no longer in the raw file is kept
    expect(saved.map((a: any) => a.id).sort()).toEqual([ev(1).id, ev(2).id, ev(3).id, "f".repeat(16)].sort());
    expect(saved.find((a: any) => a.id === ev(1).id).description).toBe("Old");
    expect(logs.join("\n")).toMatch(/1 tags don't match current events/);
  });

  it("skips invalid tag entries, logs them, and re-tags those events", async () => {
    await writeJson(paths.raw, [ev(1), ev(2)]);
    await writeJson(paths.tags, [
      { id: ev(1).id, description: "Good", tags: ["art"] },
      { id: ev(2).id, description: "Bad", tags: ["not-a-tag"] },
    ]);
    const tagged: string[] = [];
    const logs: string[] = [];
    const res = await runNormalize({ client: fake(tagged), log: (m) => logs.push(m), paths });
    expect(res).toEqual({ tagged: 2, remaining: 0 });
    expect(tagged).toEqual([ev(2).id]);
    expect(logs.join("\n")).toMatch(/1 invalid entries in events_tags\.json skipped/);
    expect(logs.join("\n")).toMatch(/entry 1:/);
  });
});

describe("runSave dry run", () => {
  it("merges, skips untagged, drops expired, fills image", async () => {
    await writeJson(paths.raw, [ev(1), ev(2), ev(3, { startsAt: "2026-11-20T19:30:00-05:00" }), ev(4, { imageUrl: "https://img.example.com/a.jpg" })]);
    await writeJson(paths.tags, [
      { id: ev(1).id, description: "New desc", tags: ["music", "art"] },
      { id: ev(3).id, description: "Past", tags: ["art"] },
      { id: ev(4).id, description: "Has image", tags: ["food"] },
    ]);
    const logs: string[] = [];
    const res = await runSave({ dryRun: true, now: NOW, log: (m) => logs.push(m), paths });
    expect(res).toEqual({ inserted: 0, skipped: 0, untagged: 1, expired: 1 });
    const out = logs.join("\n");
    expect(out).toContain("Event 2");
    expect(out).toContain("New desc");
    expect(out).not.toContain("Source description");
    expect(out).toMatch(/"imageUrl": "https:\/\/.+"/);
    expect(out).toContain("https://img.example.com/a.jpg");
  });
});

describe("runSave tags leniency", () => {
  it("skips invalid and orphan tags, logging both", async () => {
    await writeJson(paths.raw, [ev(1), ev(2)]);
    await writeJson(paths.tags, [
      { id: ev(1).id, description: "Good", tags: ["music"] },
      { id: ev(2).id, description: "Bad", tags: ["nope"] },
      { id: "f".repeat(16), description: "Orphan", tags: ["art"] },
    ]);
    const logs: string[] = [];
    const res = await runSave({ dryRun: true, now: NOW, log: (m) => logs.push(m), paths });
    expect(res).toMatchObject({ untagged: 1 });
    const out = logs.join("\n");
    expect(out).toMatch(/1 invalid entries in events_tags\.json skipped/);
    expect(out).toMatch(/1 tags don't match current events/);
  });
});

describe("runClear", () => {
  it("does nothing without --yes", async () => {
    const logs: string[] = [];
    expect(await runClear({ yes: false, log: (m) => logs.push(m) })).toBe(0);
    expect(logs.join("\n")).toContain("WARNING");
  });
});

describeDb("runSave db", () => {
  it("is idempotent", async () => {
    await resetDb();
    await writeJson(paths.raw, [ev(1), ev(2)]);
    await writeJson(paths.tags, [
      { id: ev(1).id, description: "One", tags: ["music"] },
      { id: ev(2).id, description: "Two", tags: ["art"] },
    ]);
    const first = await runSave({ now: NOW, log: () => {}, paths });
    expect(first.inserted).toBe(2);
    const second = await runSave({ now: NOW, log: () => {}, paths });
    expect(second.inserted).toBe(0);
    const { rows } = await getPool().query("SELECT count(*)::int AS n FROM events");
    expect(rows[0].n).toBe(2);
  });
});

describe("cli", () => {
  it("exits 1 on unknown stage", () => {
    const r = spawnSync("npx", ["tsx", "src/import/cli.ts", "bogus"], { cwd: serverDir, encoding: "utf8" });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("Usage");
  });
});

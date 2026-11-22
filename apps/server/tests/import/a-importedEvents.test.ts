import { beforeEach, describe, expect, it } from "vitest";
import { clearImportedEvents, insertImportedEvents } from "../../src/db/importedEvents.js";
import { getPool, withTransaction } from "../../src/db/pool.js";
import type { TaggedEvent } from "../../src/import/types.js";
import { describeDb, insertUser, resetDb } from "../helpers.js";
import { ev } from "./a-fixtures.js";

const tagged = (o: Partial<TaggedEvent> = {}): TaggedEvent => ({
  ...ev(), id: "0123456789abcdef", description: "A fun event", tags: ["music"], ...o,
});
const rows = async () =>
  (await getPool().query("SELECT * FROM events ORDER BY source_url, starts_at")).rows;
const insert = (events: TaggedEvent[]) => withTransaction((c) => insertImportedEvents(c, events));

describeDb("insertImportedEvents", () => {
  beforeEach(resetDb);

  it("inserts mapped columns with null creator", async () => {
    const result = await insert([tagged({ location: "Cafe X", lat: 42.3, lng: -71.1, imageUrl: "https://i.test/a.jpg", priceMin: 0, priceMax: 12.5 })]);
    expect(result).toEqual({ inserted: 1, skipped: 0 });
    const [row] = await rows();
    expect(row).toMatchObject({ title: "Jazz Night", description: "A fun event", tags: ["music"], location: "Cafe X", lat: 42.3, lng: -71.1, image_url: "https://i.test/a.jpg", source_url: "https://example.com/e/1", creator_id: null });
    expect(Number(row.price_max)).toBe(12.5);
    expect(row.starts_at.toISOString()).toBe("2026-11-25T00:00:00.000Z");
  });

  it("puts address into location only when location is null", async () => {
    await insert([
      tagged({ address: "1 Main St", sourceUrl: "https://example.com/a" }),
      tagged({ address: "1 Main St", location: "Cafe X", sourceUrl: "https://example.com/b" }),
    ]);
    const [a, b] = await rows();
    expect(a.location).toBe("1 Main St");
    expect(b.location).toBe("Cafe X");
  });

  it("skips existing (url, starts_at) and in-batch duplicates, but allows same url on another day", async () => {
    await insert([tagged()]);
    const result = await insert([
      tagged(), // exists
      tagged({ startsAt: "2026-11-26T19:00:00-05:00" }), // same url, new day
      tagged({ startsAt: "2026-11-26T19:00:00-05:00" }), // in-batch duplicate
      tagged({ startsAt: "2026-11-24T19:00:00-05:00", sourceUrl: "https://example.com/other" }),
    ]);
    expect(result).toEqual({ inserted: 2, skipped: 2 });
    expect(await rows()).toHaveLength(3);
  });

  it("handles empty input and more than one chunk", async () => {
    expect(await insert([])).toEqual({ inserted: 0, skipped: 0 });
    const many = Array.from({ length: 450 }, (_, i) => tagged({ sourceUrl: `https://example.com/e/${i}` }));
    expect(await insert(many)).toEqual({ inserted: 450, skipped: 0 });
  });

  it("treats quotes and SQL-looking text as data", async () => {
    await insert([tagged({ title: "Robert'); DROP TABLE events;--" })]);
    expect((await rows())[0].title).toBe("Robert'); DROP TABLE events;--");
  });
});

describeDb("clearImportedEvents", () => {
  beforeEach(resetDb);

  it("deletes imported events but keeps seed:// and user-created ones", async () => {
    const user = await insertUser("Zed");
    await insert([tagged({ sourceUrl: "https://example.com/imported" }), tagged({ sourceUrl: "seed://demo/1" })]);
    await getPool().query("INSERT INTO events (title, tags, starts_at, creator_id) VALUES ('Mine', '{music}', now(), $1)", [user]);
    await getPool().query("INSERT INTO events (title, tags, starts_at) VALUES ('No url', '{music}', now())");
    await getPool().query("INSERT INTO events (title, tags, starts_at, source_url, creator_id) VALUES ('UserUrl', '{music}', now(), 'https://u.test', $1)", [user]);
    const deleted = await withTransaction((c) => clearImportedEvents(c));
    expect(deleted).toBe(2); // imported + no-url
    expect((await rows()).map((r) => r.title).sort()).toEqual(["Jazz Night", "Mine", "UserUrl"]);
    expect((await rows()).map((r) => r.source_url)).toContain("seed://demo/1");
  });
});

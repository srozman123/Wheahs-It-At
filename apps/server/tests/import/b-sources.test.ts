import { describe, expect, it } from "vitest";
import { createBostonCalendarSource } from "../../src/import/sources/bostonCalendar.js";
import { buSource } from "../../src/import/sources/bu.js";
import { do617Source, parseClock, parseDo617Html } from "../../src/import/sources/do617.js";
import { eventbriteSource, parseEventbriteHtml } from "../../src/import/sources/eventbrite.js";
import { harvardSource } from "../../src/import/sources/harvard.js";
import { fetchAllSources } from "../../src/import/sources/index.js";
import { mitSource, northeasternSource } from "../../src/import/sources/localist.js";
import { meetupSource, parseMeetupHtml } from "../../src/import/sources/meetup.js";
import { decodeEntities, parseCost } from "../../src/import/sources/util.js";
import { ctxFor, expectSane, fakeHttp, fixture, WINDOW } from "./b-helpers.js";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

describe("parseCost", () => {
  it.each([
    ["Free", 0, 0],
    ["$10", 10, 10],
    ["$5–$15", 5, 15],
    ["$5 - $15", 5, 15],
    ["Free; $20 for non-members", 0, 20],
    ["$1,200.50", 1200.5, 1200.5],
  ])("%s", (text, lo, hi) => expect(parseCost(text)).toEqual({ priceMin: lo, priceMax: hi }));
  it("unknown -> null", () => {
    expect(parseCost("Donations welcome")).toEqual({ priceMin: null, priceMax: null });
    expect(parseCost(null)).toEqual({ priceMin: null, priceMax: null });
  });
  it("decodes entities", () => expect(decodeEntities("a &amp; b &#8217; &ndash;")).toBe("a & b ’ –"));
});

describe("thebostoncalendar", () => {
  const path = fileURLToPath(new URL("./fixtures/bostoncalendar_small.json", import.meta.url));
  it("maps snake_case, drops invalid and out-of-window rows", async () => {
    const out = await createBostonCalendarSource(path).fetch(ctxFor(fakeHttp({})));
    expect(out.map((e) => e.title)).toEqual(["Holiday Pops & Friends", "Winter Market"]);
    expect(out[0]).toMatchObject({ lat: 42.3427, imageUrl: expect.stringContaining("media.thebostoncalendar.com"), startsAt: "2026-11-21T19:30:00-05:00" });
    expect(out[1].startsAt).toBe("2026-11-22T10:00:00-05:00"); // ongoing_until ignored
  });
  it("maps midnight starts (no time on the list) to the date-only time", async () => {
    const dir = join(fileURLToPath(new URL("../..", import.meta.url)), `data/test-tmp-b-${process.pid}`);
    await mkdir(dir, { recursive: true });
    try {
      const file = join(dir, "bc.json");
      const row = { title: "All Day Fair", starts_at: "2026-11-22T00:00:00-05:00", source_url: "https://www.thebostoncalendar.com/events/fair" };
      await writeFile(file, JSON.stringify([row, { ...row, title: "Late Show", starts_at: "2026-11-22T00:30:00-05:00", source_url: "https://www.thebostoncalendar.com/events/late" }]));
      const out = await createBostonCalendarSource(file).fetch(ctxFor(fakeHttp({})));
      expect(out.map((e) => e.startsAt).sort()).toEqual(["2026-11-22T00:30:00-05:00", "2026-11-22T12:00:00-05:00"]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  it("nulls relative image URLs instead of dropping the event", async () => {
    const dir = join(fileURLToPath(new URL("../..", import.meta.url)), `data/test-tmp-b2-${process.pid}`);
    await mkdir(dir, { recursive: true });
    try {
      const file = join(dir, "bc.json");
      await writeFile(file, JSON.stringify([{ title: "Fair", starts_at: "2026-11-22T10:00:00-05:00", image_url: "/system/events/photos/000/239/715/thumb/a.jpg", source_url: "https://www.thebostoncalendar.com/events/fair" }]));
      const out = await createBostonCalendarSource(file).fetch(ctxFor(fakeHttp({})));
      expect(out).toHaveLength(1);
      expect(out[0].imageUrl).toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  it("returns [] with a hint when the file is missing", async () => {
    const logs: string[] = [];
    expect(await createBostonCalendarSource("/nonexistent/x.json").fetch(ctxFor(fakeHttp({}), WINDOW, logs))).toEqual([]);
    expect(logs.join("\n")).toMatch(/parse_bostoncalendar\.py/);
  });
});

describe("eventbrite", () => {
  it("parses the ItemList fixture", async () => {
    const requested: string[] = [];
    const http = fakeHttp({ "https://www.eventbrite.com/d/ma--boston/events--this-week/": "eventbrite_list.html" }, requested);
    const out = await eventbriteSource.fetch(ctxFor(http));
    expect(out.length).toBeGreaterThan(5);
    expectSane(out);
    expect(out[0]).toMatchObject({ source: "eventbrite", startsAt: "2026-11-22T12:00:00-05:00" });
    expect(out.some((e) => e.lat !== null && e.imageUrl)).toBe(true);
    expect(requested.length).toBeGreaterThan(0);
  });
  it("handles single Event, array, ItemList and offers", () => {
    const ev = (n: string, extra = {}) => ({ "@type": "Event", name: n, startDate: "2026-11-22T19:00:00", url: `https://www.eventbrite.com/e/${n}`, ...extra });
    const page = (j: unknown) => `<script type="application/ld+json">${JSON.stringify(j)}</script>`;
    const html = [
      page(ev("single", { offers: { "@type": "Offer", price: "0" } })),
      page([ev("arr", { offers: { lowPrice: "10", highPrice: "25.5" } })]),
      page({ "@type": "ItemList", itemListElement: [{ "@type": "ListItem", item: ev("listed") }] }),
      page(ev("online", { eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode" })),
      '<script type="application/ld+json">{broken</script>',
    ].join("\n");
    const rows = parseEventbriteHtml(html) as { title: string; priceMin: number | null; priceMax: number | null; startsAt: string }[];
    expect(rows.map((r) => r.title)).toEqual(["single", "arr", "listed"]);
    expect(rows[0]).toMatchObject({ priceMin: 0, priceMax: 0, startsAt: "2026-11-22T19:00:00-05:00" });
    expect(rows[1]).toMatchObject({ priceMin: 10, priceMax: 25.5 });
    expect(rows[2]).toMatchObject({ priceMin: null, priceMax: null });
  });
});

describe("do617", () => {
  it("parseClock", () => {
    expect(parseClock("6 pm")).toBe("18:00");
    expect(parseClock("3 pm - 7 pm")).toBe("15:00");
    expect(parseClock("12 am")).toBe("00:00");
    expect(parseClock("7:30 pm")).toBe("19:30");
    expect(parseClock("all day")).toBeNull();
  });
  it("parses cards from the fixture", () => {
    const cards = parseDo617Html(fixture("do617_list.html"));
    expect(cards.length).toBeGreaterThanOrEqual(15);
    expect(cards[0]).toMatchObject({ title: "Holiday Tree Lighting", date: "2026-11-21", venue: "Faneuil Hall" });
    expect(cards[0].url).toBe("https://do617.com/events/2026/11/21/faneuil-hall-marketplace-s-annual-holiday-tree-lighting-tickets");
    expect(cards[0].hints).toContain("Community/Family");
  });
  it("produces events; ongoing runs start today", async () => {
    const http = fakeHttp({ "https://do617.com/events": "do617_list.html" });
    const out = await do617Source.fetch(ctxFor(http));
    expect(out.length).toBeGreaterThan(10);
    expectSane(out);
    const tree = out.find((e) => e.title === "Holiday Tree Lighting")!;
    expect(tree.startsAt).toBe("2026-11-21T18:00:00-05:00");
    expect(tree.imageUrl).toMatch(/^https:/);
    const zoo = out.find((e) => /zoolights/i.test(e.sourceUrl));
    if (zoo) expect(zoo.startsAt.slice(0, 10)).toBe("2026-11-20");
  });
});

describe("localist", () => {
  it("northeastern", async () => {
    const out = await northeasternSource.fetch(ctxFor(fakeHttp({ "https://calendar.northeastern.edu/api/2/events?days=7&pp=100": "northeastern.json" })));
    expect(out.length).toBeGreaterThan(5);
    expectSane(out);
    expect(out.find((e) => e.title === "Concert Band Fall Concert")).toMatchObject({
      startsAt: "2026-11-22T17:00:00-05:00", priceMin: 0, priceMax: 0, location: "Fenway Center", lat: 42.341984,
      sourceUrl: "https://calendar.northeastern.edu/event/nu-concert-band-pep-band",
    });
  });
  it("mit drops fake 1:00am athletics and generic images", async () => {
    const logs: string[] = [];
    const out = await mitSource.fetch(ctxFor(fakeHttp({ "https://calendar.mit.edu/api/2/events?days=7&pp=100": "mit.json" }), WINDOW, logs));
    expectSane(out);
    expect(out.length).toBeGreaterThan(10);
    expect(out.some((e) => e.startsAt.includes("T01:00:00"))).toBe(false);
    expect(out.filter((e) => e.title.startsWith("Women's Basketball")).every((e) => e.imageUrl === null)).toBe(true);
    expect(logs.join()).toMatch(/fake 1:00am/);
    expect(out.some((e) => e.startsAt.includes("T12:00:00"))).toBe(true); // all_day instances
    expect(out.some((e) => e.startsAt.includes("T00:00:00"))).toBe(false);
  });
});

describe("harvard", () => {
  it("parses LiveWhale JSON", async () => {
    const out = await harvardSource.fetch(ctxFor(fakeHttp({ "https://events.college.harvard.edu/live/json/events": "harvard.json" })));
    expect(out.length).toBeGreaterThan(10);
    expectSane(out);
    expect(out.some((e) => e.priceMin === 0 && e.priceMax === 0)).toBe(true);
    expect(out.some((e) => e.imageUrl)).toBe(true);
    expect(out[0].hints.length).toBeGreaterThan(0);
    // all-day events get the date-only time, never midnight
    expect(out.some((e) => e.startsAt.includes("T12:00:00"))).toBe(true);
    expect(out.some((e) => e.startsAt.includes("T00:00:00"))).toBe(false);
  });
});

describe("bu", () => {
  it("lists a day then fetches details", async () => {
    const requested: string[] = [];
    const http = fakeHttp({ "https://www.bu.edu/calendar/rpc/events.json.php": "bu_day.json", "https://www.bu.edu/calendar/rpc/event.json.php": "bu_detail.json" }, requested);
    const window = { start: new Date("2026-11-22T05:00:00Z"), end: new Date("2026-11-23T04:59:00Z") };
    const out = await buSource.fetch(ctxFor(http, window));
    expect(requested[0]).toBe("https://www.bu.edu/calendar/rpc/events.json.php?day=20261122");
    expect(requested[1]).toContain("uid=323021%4017.calendar.bu.edu");
    // Every detail returns the same fixture event, but each keeps the start time from the day list (its own occurrence).
    expect(new Set(out.map((e) => e.startsAt)).size).toBe(out.length);
    expect(out.length).toBeGreaterThan(1);
    const jessica = out.find((e) => e.startsAt === "2026-11-22T19:00:00-05:00")!;
    expect(jessica).toMatchObject({ title: "Jessica of Venice", startsAt: "2026-11-22T19:00:00-05:00", location: "949 Commonwealth Avenue", priceMin: 15, priceMax: 40, imageUrl: null });
    expect(jessica.description!.length).toBeLessThanOrEqual(500);
    expect(jessica.description).toMatch(/^Convening in a forgotten library/);
  });

  it("caps detail fetches evenly per day and logs it", async () => {
    const dayJson = JSON.parse(fixture("bu_day.json"));
    const mk = (n: number) => ({ ...dayJson.ResultSet.Result[0], uid: `u${n}@x` });
    const requested: string[] = [];
    const logs: string[] = [];
    const http = {
      getText: async () => "",
      contentType: async () => "image/jpeg",
      getJson: async <T,>(url: string) => {
        requested.push(url);
        if (url.includes("events.json.php")) return { ResultSet: { Result: Array.from({ length: 100 }, (_, i) => mk(i)) } } as T;
        return JSON.parse(fixture("bu_detail.json")) as T;
      },
    };
    const window = { start: new Date("2026-11-22T05:00:00Z"), end: new Date("2026-11-24T04:59:00Z") }; // 2 days
    await buSource.fetch(ctxFor(http, window, logs));
    const details = requested.filter((u) => u.includes("event.json.php"));
    expect(details.length).toBe(80); // 40 per day
    expect(details.filter((u) => u.includes("day=20261123")).length).toBe(40);
    expect(logs.join()).toMatch(/per day/);
  });
});

describe("meetup", () => {
  it("parses Apollo state, drops online events", async () => {
    const out = await meetupSource.fetch(ctxFor(fakeHttp({ "https://www.meetup.com/find/": "meetup.html" })));
    expect(out.length).toBeGreaterThan(3);
    expectSane(out);
    expect(out.some((e) => /Be The Bank/.test(e.title))).toBe(false);
    expect(out.find((e) => /Generative AI/.test(e.title))).toMatchObject({ priceMin: 22, priceMax: 22 });
  });
  it("returns [] on unknown format", async () => {
    const logs: string[] = [];
    const http = { getText: async () => "<html>nothing</html>", getJson: async () => ({}) as never, contentType: async () => null };
    expect(await meetupSource.fetch(ctxFor(http, WINDOW, logs))).toEqual([]);
    expect(logs.join()).toMatch(/not recognized/);
    expect(parseMeetupHtml("<html></html>")).toBeNull();
  });
});

describe("fetchAllSources", () => {
  it("isolates failures and unknown names", async () => {
    // No fixture is registered for harvard, so the fake client throws for it.
    const http = fakeHttp({ "https://calendar.northeastern.edu/api/2/events": "northeastern.json" });
    const logs: string[] = [];
    const { events, report } = await fetchAllSources(["harvard", "nope", "northeastern"], ctxFor(http, WINDOW, logs));
    expect(report[0]).toMatchObject({ source: "harvard", count: 0, error: expect.stringContaining("no fixture") });
    expect(report[1].error).toMatch(/unknown/);
    expect(report[2]).toMatchObject({ source: "northeastern", count: events.length });
    expect(events.length).toBeGreaterThan(0);
  });
});

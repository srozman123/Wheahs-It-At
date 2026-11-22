import { describe, expect, it } from "vitest";
import { dedupeEvents, titleSimilarity } from "../../src/import/dedupe.js";
import { ev } from "./a-fixtures.js";

describe("titleSimilarity", () => {
  it("ignores case, punctuation, accents, stopwords and order", () => {
    expect(titleSimilarity("Café Jazz Night!", "cafe JAZZ night")).toBe(1);
    expect(titleSimilarity("The Jazz Night at Cafe", "Cafe Jazz Night")).toBe(1);
    expect(titleSimilarity("Jazz Night", "Poetry Slam")).toBe(0);
  });
});

describe("dedupeEvents", () => {
  it("merges same-title same-day events, filling nulls and unioning hints", () => {
    const a = ev({ source: "do617", sourceUrl: "https://do617.com/1", description: "desc", hints: ["music"] });
    const b = ev({ source: "eventbrite", sourceUrl: "https://eb.com/1", imageUrl: "https://img.test/a.jpg", lat: 42.35, lng: -71.06, location: "Cafe X", priceMin: 0, priceMax: 0, hints: ["jazz", "music"] });
    const out = dedupeEvents([a, b]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ source: "eventbrite", sourceUrl: "https://eb.com/1", description: "desc", imageUrl: "https://img.test/a.jpg", lat: 42.35, priceMin: 0 });
    expect(out[0].hints.sort()).toEqual(["jazz", "music"]);
  });

  it("picks the winner by source priority", () => {
    const out = dedupeEvents([ev({ source: "meetup", sourceUrl: "https://m.com/1" }), ev({ source: "thebostoncalendar", sourceUrl: "https://t.com/1" })]);
    expect(out[0].source).toBe("thebostoncalendar");
  });

  it("uses the New York calendar day, not UTC", () => {
    // 11:30pm and 12:30am NY: different NY days even though 1 hour apart (UTC: 04:30 vs 05:30 on the 25th).
    const late = ev({ startsAt: "2026-11-24T23:30:00-05:00", sourceUrl: "https://x.com/1" });
    const after = ev({ startsAt: "2026-11-25T00:30:00-05:00", sourceUrl: "https://x.com/2" });
    expect(dedupeEvents([late, after])).toHaveLength(2);
    // 10pm and 11pm NY on the same day: the same day in NY, different UTC days.
    const a = ev({ startsAt: "2026-11-24T22:00:00-05:00", sourceUrl: "https://x.com/3" });
    const b = ev({ startsAt: "2026-11-24T23:00:00-05:00", sourceUrl: "https://x.com/4" });
    expect(dedupeEvents([a, b])).toHaveLength(1);
  });

  it("works across DST (summer offset)", () => {
    const a = ev({ startsAt: "2026-07-04T23:30:00-04:00", sourceUrl: "https://x.com/1" });
    const b = ev({ startsAt: "2026-07-05T00:30:00-04:00", sourceUrl: "https://x.com/2" });
    expect(dedupeEvents([a, b])).toHaveLength(2);
  });

  it("separates same title at distant venues, merges nearby or contained names", () => {
    const far = [ev({ lat: 42.36, lng: -71.06, sourceUrl: "https://x.com/1" }), ev({ lat: 42.5, lng: -71.2, sourceUrl: "https://x.com/2" })];
    expect(dedupeEvents(far)).toHaveLength(2);
    const near = [ev({ lat: 42.36, lng: -71.06, sourceUrl: "https://x.com/1" }), ev({ lat: 42.3605, lng: -71.0605, sourceUrl: "https://x.com/2" })];
    expect(dedupeEvents(near)).toHaveLength(1);
    const names = [ev({ location: "Cafe X", sourceUrl: "https://x.com/1" }), ev({ location: "Cafe X, Boston", sourceUrl: "https://x.com/2" })];
    expect(dedupeEvents(names)).toHaveLength(1);
    const different = [ev({ location: "Cafe X", sourceUrl: "https://x.com/1" }), ev({ location: "Berklee Hall", sourceUrl: "https://x.com/2" })];
    expect(dedupeEvents(different)).toHaveLength(2);
  });

  it("keeps different titles on the same day", () => {
    expect(dedupeEvents([ev(), ev({ title: "Poetry Slam", sourceUrl: "https://x.com/2" })])).toHaveLength(2);
  });

  it("does not merge same sourceUrl + startsAt when the titles differ (generic org URLs)", () => {
    expect(dedupeEvents([ev({ title: "Alpha" }), ev({ title: "Totally Different" })])).toHaveLength(2);
  });

  it("merges same sourceUrl + startsAt with similar titles even if venues differ", () => {
    const out = dedupeEvents([ev({ location: "Hall A" }), ev({ location: "Room 5", source: "bu" })]);
    expect(out).toHaveLength(1);
  });

  it("does not merge same title and venue more than 2 hours apart", () => {
    const a = ev({ title: "Story Time", location: "Library", startsAt: "2026-11-24T10:00:00-05:00", sourceUrl: "https://x.com/1" });
    const b = ev({ title: "Story Time", location: "Library", startsAt: "2026-11-24T14:00:00-05:00", sourceUrl: "https://x.com/2" });
    expect(dedupeEvents([a, b])).toHaveLength(2);
  });

  it("merges starts 30 minutes apart", () => {
    const a = ev({ location: "Library", startsAt: "2026-11-24T19:00:00-05:00", sourceUrl: "https://x.com/1" });
    const b = ev({ location: "Library", startsAt: "2026-11-24T19:30:00-05:00", sourceUrl: "https://x.com/2" });
    expect(dedupeEvents([a, b])).toHaveLength(1);
  });

  it("merges a date-only start with a timed start on the same day", () => {
    const a = ev({ location: "Library", startsAt: "2026-11-24T12:00:00-05:00", sourceUrl: "https://x.com/1", source: "bu" });
    const b = ev({ location: "Library", startsAt: "2026-11-24T19:00:00-05:00", sourceUrl: "https://x.com/2" });
    expect(dedupeEvents([a, b])).toHaveLength(1);
  });

  it("keeps the same winner when a lower-priority duplicate becomes richer", () => {
    const top = ev({ source: "thebostoncalendar", sourceUrl: "https://t.com/1", startsAt: "2026-11-24T19:00:00-05:00" });
    const low = ev({ source: "meetup", sourceUrl: "https://m.com/1", startsAt: "2026-11-24T19:15:00-05:00" });
    const before = dedupeEvents([top, low])[0];
    const richer = { ...low, description: "d", imageUrl: "https://img.test/a.jpg", location: "X", lat: 1, lng: 2, priceMin: 0, priceMax: 0, hints: ["a"] };
    const after = dedupeEvents([top, richer])[0];
    expect(after.sourceUrl).toBe(before.sourceUrl);
    expect(after.startsAt).toBe(before.startsAt);
    expect(after.description).toBe("d"); // still back-filled
  });

  it("keeps same url on different days (recurring)", () => {
    expect(dedupeEvents([ev(), ev({ startsAt: "2026-11-25T19:00:00-05:00" })])).toHaveLength(2);
  });

  it("is deterministic regardless of input order and sorts by time then title", () => {
    const events = [
      ev({ title: "Zed", startsAt: "2026-11-25T19:00:00-05:00", sourceUrl: "https://x.com/z" }),
      ev({ title: "Beta Show", sourceUrl: "https://x.com/b" }),
      ev({ title: "Alpha Show", sourceUrl: "https://x.com/a" }),
    ];
    const out = dedupeEvents(events);
    expect(out.map((e) => e.title)).toEqual(["Alpha Show", "Beta Show", "Zed"]);
    expect(dedupeEvents([...events].reverse())).toEqual(out);
  });

  it("does not mutate input", () => {
    const a = ev({ sourceUrl: "https://x.com/1" });
    const b = ev({ sourceUrl: "https://x.com/2", description: "d" });
    dedupeEvents([a, b]);
    expect(a.description).toBeNull();
  });
});

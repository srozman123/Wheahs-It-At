import { describe, expect, it } from "vitest";
import { expandOccurrences } from "../../src/import/recurring.js";
import { isDateOnlyStart, nyLocalToIso, toNyIso, windowDays } from "../../src/import/time.js";
import type { SourceEvent } from "../../src/import/types.js";

describe("nyLocalToIso", () => {
  it("uses EST in winter", () => expect(nyLocalToIso("2026-11-21", "19:30")).toBe("2026-11-21T19:30:00-05:00"));
  it("uses EDT in summer", () => expect(nyLocalToIso("2026-07-04", "21:00")).toBe("2026-07-04T21:00:00-04:00"));
  it("null time is noon (date-only)", () => expect(nyLocalToIso("2026-11-21", null)).toBe("2026-11-21T12:00:00-05:00"));
  it("handles the spring-forward day (2026-03-08)", () => {
    expect(nyLocalToIso("2026-03-08", "01:30")).toBe("2026-03-08T01:30:00-05:00");
    expect(nyLocalToIso("2026-03-08", "12:00")).toBe("2026-03-08T12:00:00-04:00");
  });
  it("handles the fall-back day (2026-11-01)", () => {
    expect(nyLocalToIso("2026-11-01", "00:30")).toBe("2026-11-01T00:30:00-04:00");
    expect(nyLocalToIso("2026-11-01", "12:00")).toBe("2026-11-01T12:00:00-05:00");
  });
  it("rejects garbage", () => expect(() => nyLocalToIso("nope", null)).toThrow());
});

describe("toNyIso", () => {
  it("converts Z", () => expect(toNyIso("2026-11-21T00:30:00Z")).toBe("2026-11-20T19:30:00-05:00"));
  it("converts Z in EDT", () => expect(toNyIso("2026-07-04T01:00:00.000Z")).toBe("2026-07-03T21:00:00-04:00"));
  it("converts other offsets", () => expect(toNyIso("2026-11-21T18:00:00-06:00")).toBe("2026-11-21T19:00:00-05:00"));
  it("treats offset-less as NY wall time", () => {
    expect(toNyIso("2026-11-21T19:30")).toBe("2026-11-21T19:30:00-05:00");
    expect(toNyIso("2026-06-21T19:30:15")).toBe("2026-06-21T19:30:15-04:00");
  });
  it("date-only is noon NY", () => expect(toNyIso("2026-11-22")).toBe("2026-11-22T12:00:00-05:00"));
  it("null when unparseable", () => {
    expect(toNyIso("tomorrow-ish")).toBeNull();
    expect(toNyIso("")).toBeNull();
  });
});

describe("windowDays", () => {
  it("lists NY dates start..end inclusive", () => {
    expect(windowDays({ start: new Date("2026-11-22T05:00:00Z"), end: new Date("2026-11-24T20:00:00Z") })).toEqual(["2026-11-22", "2026-11-23", "2026-11-24"]);
  });
});

describe("expandOccurrences", () => {
  const base: Omit<SourceEvent, "startsAt"> = {
    source: "x", title: "Weekly Trivia", description: null, location: null, address: null, lat: null, lng: null,
    imageUrl: null, sourceUrl: "https://example.com/e", priceMin: null, priceMax: null, hints: ["trivia"],
  };
  const window = { start: new Date("2026-11-21T00:00:00-05:00"), end: new Date("2026-11-28T00:00:00-05:00") };
  it("keeps inclusive edges, drops outside, dedupes by instant, sorts", () => {
    const out = expandOccurrences(
      base,
      ["2026-11-28T00:00:00-05:00", "2026-11-21T00:00:00-05:00", "2026-11-24T19:00:00-05:00", "2026-11-25T00:00:00Z"[0] && "2026-11-24T19:00:00-05:00", "2026-11-20T23:59:59-05:00", "2026-11-28T00:00:01-05:00", "garbage"],
      window,
    );
    expect(out.map((e) => e.startsAt)).toEqual(["2026-11-21T00:00:00-05:00", "2026-11-24T19:00:00-05:00", "2026-11-28T00:00:00-05:00"]);
    expect(out[0].title).toBe("Weekly Trivia");
  });
  it("dedupes the same instant spelled with different offsets", () => {
    expect(expandOccurrences(base, ["2026-11-24T19:00:00-05:00", "2026-11-25T00:00:00Z"], window)).toHaveLength(1);
  });
});

describe("isDateOnlyStart", () => {
  it("is true only for noon NY wall time", () => {
    expect(isDateOnlyStart("2026-11-21T12:00:00-05:00")).toBe(true);
    expect(isDateOnlyStart("2026-11-21T17:00:00Z")).toBe(true);
    expect(isDateOnlyStart("2026-07-04T12:00:00-04:00")).toBe(true);
    expect(isDateOnlyStart("2026-11-21T12:30:00-05:00")).toBe(false);
    expect(isDateOnlyStart("2026-11-21T00:00:00-05:00")).toBe(false);
  });
});

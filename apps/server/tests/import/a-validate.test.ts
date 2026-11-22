import { describe, expect, it } from "vitest";
import { isUpcoming, validateEvents } from "../../src/import/validate.js";
import { ev } from "./a-fixtures.js";

const window = { start: new Date("2026-11-23T00:00:00Z"), end: new Date("2026-11-30T00:00:00Z") };
const reasons = (events: ReturnType<typeof ev>[]) => validateEvents(events, window).dropped.map((d) => d.reason);

describe("validateEvents", () => {
  it("keeps good events and trims/collapses titles", () => {
    const { kept, dropped } = validateEvents([ev({ title: "  Jazz   \n Night " })], window);
    expect(dropped).toEqual([]);
    expect(kept[0].title).toBe("Jazz Night");
  });

  it("drops events outside the window, keeps boundaries", () => {
    const r = validateEvents(
      [ev({ startsAt: "2026-11-22T10:00:00Z" }), ev({ startsAt: "2026-12-01T10:00:00Z" }), ev({ startsAt: "2026-11-23T00:00:00Z" }), ev({ startsAt: "2026-11-30T00:00:00Z" })],
      window,
    );
    expect(r.kept).toHaveLength(2);
    expect(r.dropped.map((d) => d.reason)).toEqual(["outside import window", "outside import window"]);
  });

  it("drops online/virtual by location or address, whole word only", () => {
    for (const location of ["Online", "virtual event", "Zoom", "Livestream", "Online - Zoom"]) {
      expect(reasons([ev({ location })])).toEqual(["online event"]);
    }
    expect(reasons([ev({ address: "Virtual" })])).toEqual(["online event"]);
    expect(reasons([ev({ location: "Onlinevillage Hall" })])).toEqual([]);
  });

  it("does not drop a title that merely contains Online, but drops marker prefixes", () => {
    expect(reasons([ev({ title: "Online Marketing Meetup at WeWork", location: "WeWork" })])).toEqual([]);
    expect(reasons([ev({ title: "[Online] Yoga" })])).toEqual(["online event"]);
    expect(reasons([ev({ title: "(Virtual) Trivia" })])).toEqual(["online event"]);
  });

  it("checks prices: min > max dropped, one null kept", () => {
    expect(reasons([ev({ priceMin: 20, priceMax: 10 })])).toEqual(["priceMin > priceMax"]);
    expect(reasons([ev({ priceMin: 5, priceMax: null }), ev({ priceMin: null, priceMax: 5, sourceUrl: "https://example.com/2" })])).toEqual([]);
  });

  it("drops schema-invalid events and reports title and source", () => {
    const r = validateEvents([ev({ title: "   ", source: "do617" }), ev({ sourceUrl: "nope" })], window);
    expect(r.kept).toEqual([]);
    expect(r.dropped[0]).toMatchObject({ source: "do617" });
    expect(r.dropped[0].reason).toMatch(/^invalid/);
    expect(r.dropped).toHaveLength(2);
  });
});

describe("isUpcoming", () => {
  const now = new Date("2026-11-23T12:00:00Z");
  it("is inclusive of now and false for past or garbage", () => {
    expect(isUpcoming("2026-11-23T12:00:00Z", now)).toBe(true);
    expect(isUpcoming("2026-11-23T11:59:59Z", now)).toBe(false);
    expect(isUpcoming("2026-11-24T00:00:00Z", now)).toBe(true);
    expect(isUpcoming("garbage", now)).toBe(false);
  });
});

describe("online titles, placeholders, out-of-state", () => {
  it("drops webinar/virtual/zoom/livestream/online only titles with no physical place", () => {
    for (const title of ["PhD Program Webinar - Info", "Virtual Open House", "Zoom Coffee Hour", "Concert Livestream", "Talk (online only)"]) {
      expect(reasons([ev({ title })])).toEqual(["online event"]);
    }
  });
  it("keeps such titles when there is a physical location, and in-person 'Online Marketing' events", () => {
    expect(reasons([ev({ title: "Webinar Room Tour", location: "Cafe X" })])).toEqual([]);
    expect(reasons([ev({ title: "Online Marketing Meetup at WeWork" })])).toEqual([]);
    expect(reasons([ev({ title: "Zoom Fatigue Talk", location: "Zoom" })])).toEqual(["online event"]);
  });
  it("turns placeholder locations into null", () => {
    for (const location of ["Log in to view details", "TBA", "TBD", "To be announced"]) {
      const { kept } = validateEvents([ev({ location, address: location })], window);
      expect(kept[0].location).toBeNull();
      expect(kept[0].address).toBeNull();
    }
    expect(validateEvents([ev({ location: "Tabard Inn" })], window).kept[0].location).toBe("Tabard Inn");
  });
  it("drops events located in another state", () => {
    for (const location of ["Bethlehem, Pa.", "Hartford, CT", "New York, NY 10001", "Albany, N.Y., Arena", "Durham, N.H."]) {
      expect(reasons([ev({ location })]), location).toEqual(["outside Massachusetts"]);
    }
    expect(reasons([ev({ title: "Away", location: "Cafe", address: "5 Main St, Providence, RI" })])).toEqual(["outside Massachusetts"]);
  });
  it("keeps Massachusetts and ordinary text", () => {
    for (const location of ["Cambridge, MA, Bright-Landry Hockey Center", "Boston, MA 02115", "Boston, Mass.", "Room 4, Hall in Boston", "Cafe, ME Studio", "Meet in the lobby, or outside", "Hall 12, Boston"]) {
      expect(reasons([ev({ location })]), location).toEqual([]);
    }
  });
});

describe("validateEvents whitespace in places", () => {
  it("collapses newlines in location and address", () => {
    const { kept } = validateEvents(
      [ev({ startsAt: "2026-11-24T19:00:00-05:00", location: "  BU\nMetcalf Hall ", address: "915 Commonwealth Ave\nBoston, MA 02215" })],
      window,
    );
    expect(kept[0].location).toBe("BU Metcalf Hall");
    expect(kept[0].address).toBe("915 Commonwealth Ave Boston, MA 02215");
  });
});

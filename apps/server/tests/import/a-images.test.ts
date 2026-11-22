import { describe, expect, it } from "vitest";
import { DEFAULT_IMAGES } from "../../src/import/defaultImages.js";
import { findPageImage, pickDefaultImage, resolveImages } from "../../src/import/images.js";
import type { HttpClient } from "../../src/import/types.js";
import { ev } from "./a-fixtures.js";

function fakeHttp(pages: Record<string, string | Error>, types: Record<string, string | null>) {
  const calls = { text: [] as string[], type: [] as string[] };
  const http: HttpClient = {
    getText: async (url) => {
      calls.text.push(url);
      const page = pages[url];
      if (page === undefined || page instanceof Error) throw page ?? new Error("404");
      return page;
    },
    getJson: async () => {
      throw new Error("unused");
    },
    contentType: async (url) => (calls.type.push(url), types[url] ?? null),
  };
  return { http, calls };
}

describe("findPageImage", () => {
  const page = "https://site.test/events/1";
  it("handles either attribute order, twitter:image, relative urls and &amp;", () => {
    expect(findPageImage('<meta property="og:image" content="https://c.test/a.jpg">', page)).toBe("https://c.test/a.jpg");
    expect(findPageImage("<meta content='/img/a.jpg?x=1&amp;y=2' property='og:image' />", page)).toBe("https://site.test/img/a.jpg?x=1&y=2");
    expect(findPageImage('<meta name="twitter:image" content="a.jpg">', page)).toBe("https://site.test/events/a.jpg");
    expect(findPageImage('<meta property="og:title" content="x">', page)).toBeNull();
  });
});

describe("resolveImages", () => {
  it("keeps a good image after a content-type check", async () => {
    const { http, calls } = fakeHttp({}, { "https://c.test/a.jpg": "image/jpeg" });
    const [out] = await resolveImages([ev({ imageUrl: "https://c.test/a.jpg" })], http);
    expect(out.imageUrl).toBe("https://c.test/a.jpg");
    expect(calls.text).toEqual([]);
  });

  it("trusts media.thebostoncalendar.com without a request", async () => {
    const { http, calls } = fakeHttp({}, {});
    const url = "https://media.thebostoncalendar.com/x/photo.jpg";
    const [out] = await resolveImages([ev({ imageUrl: url })], http);
    expect(out.imageUrl).toBe(url);
    expect(calls.type).toEqual([]);
  });

  it("rejects logos/placeholders/svg/gif and falls back to og:image", async () => {
    for (const bad of ["https://c.test/Logo.png", "https://c.test/img/default-event.jpg", "https://c.test/a.svg", "https://c.test/a.gif", "https://c.test/favicon.ico"]) {
      const { http, calls } = fakeHttp(
        { "https://example.com/e/1": '<meta property="og:image" content="/real.jpg">' },
        { "https://example.com/real.jpg": "image/jpeg" },
      );
      const [out] = await resolveImages([ev({ imageUrl: bad })], http);
      expect(out.imageUrl).toBe("https://example.com/real.jpg");
      expect(calls.type).not.toContain(bad);
    }
  });

  it("rejects non-image content types, then null when og:image is bad too", async () => {
    const { http } = fakeHttp(
      { "https://example.com/e/1": '<meta property="og:image" content="https://c.test/logo.png">' },
      { "https://c.test/a.jpg": "text/html" },
    );
    const [out] = await resolveImages([ev({ imageUrl: "https://c.test/a.jpg" })], http);
    expect(out.imageUrl).toBeNull();
  });

  it("uses og:image when imageUrl is missing; null when page has none", async () => {
    const { http } = fakeHttp(
      { "https://example.com/e/1": '<meta property="og:image" content="https://c.test/o.jpg">', "https://example.com/e/2": "<html></html>" },
      { "https://c.test/o.jpg": "image/jpeg" },
    );
    const out = await resolveImages([ev(), ev({ sourceUrl: "https://example.com/e/2" })], http);
    expect(out.map((e) => e.imageUrl)).toEqual(["https://c.test/o.jpg", null]);
  });

  it("never throws: errors give null and are logged; input not mutated", async () => {
    const logs: string[] = [];
    const { http } = fakeHttp({ "https://example.com/e/1": new Error("boom") }, {});
    const input = ev({ imageUrl: "https://c.test/a.jpg" });
    const [out] = await resolveImages([input], http, (m) => logs.push(m));
    expect(out.imageUrl).toBeNull();
    expect(logs).toHaveLength(1);
    expect(input.imageUrl).toBe("https://c.test/a.jpg");
  });
});

describe("pickDefaultImage", () => {
  it("is deterministic and prefers images matching the first tag", () => {
    const a = pickDefaultImage(["sports"], "abc");
    expect(pickDefaultImage(["sports"], "abc")).toBe(a);
    expect(a.tags).toContain("sports");
  });

  it("falls through to later tags, then generic/any image", () => {
    const withTag = DEFAULT_IMAGES.find((i) => i.tags.length > 0)!;
    expect(pickDefaultImage(["comedy", withTag.tags[0]], "id1").tags).toContain(withTag.tags[0]);
    expect(DEFAULT_IMAGES).toContain(pickDefaultImage([], "id2"));
  });
});

describe("noFetchHosts", () => {
  it("never fetches pages or probes images on thebostoncalendar.com, but trusts media.thebostoncalendar.com", async () => {
    const { http, calls } = fakeHttp({}, {});
    const [a, b] = await resolveImages(
      [
        ev({ sourceUrl: "https://www.thebostoncalendar.com/events/x", imageUrl: null }),
        ev({ sourceUrl: "https://www.thebostoncalendar.com/events/y", imageUrl: "https://media.thebostoncalendar.com/images/a.jpg" }),
      ],
      http,
    );
    expect(a.imageUrl).toBeNull();
    expect(b.imageUrl).toBe("https://media.thebostoncalendar.com/images/a.jpg");
    expect(calls.text).toEqual([]);
    expect(calls.type).toEqual([]);
  });
});

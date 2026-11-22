import type { SourceEvent } from "../../src/import/types.js";

export function ev(overrides: Partial<SourceEvent> = {}): SourceEvent {
  return {
    source: "eventbrite",
    title: "Jazz Night",
    description: null,
    startsAt: "2026-11-24T19:00:00-05:00",
    location: null,
    address: null,
    lat: null,
    lng: null,
    imageUrl: null,
    sourceUrl: "https://example.com/e/1",
    priceMin: null,
    priceMax: null,
    hints: [],
    ...overrides,
  };
}

import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { buildTaggingInput, tagBatch, tagEvents } from "../../src/import/normalize.js";
import type { RawEvent } from "../../src/import/types.js";

function ev(n: number, extra: Partial<RawEvent> = {}): RawEvent {
  return {
    id: n.toString(16).padStart(16, "0"),
    source: "test",
    title: `Event ${n}`,
    description: null,
    startsAt: "2026-11-21T19:30:00-05:00",
    location: "Somewhere",
    address: "1 Main St",
    lat: 42.3,
    lng: -71.1,
    imageUrl: null,
    sourceUrl: `https://example.com/${n}`,
    priceMin: null,
    priceMax: null,
    hints: ["music"],
    ...extra,
  };
}

type Reply = { stop_reason?: string; parsed_output?: unknown } | Error;
function fakeClient(replies: Reply[]) {
  const calls: any[] = [];
  const client = {
    messages: {
      parse: async (params: any) => {
        calls.push(params);
        const r = replies.shift();
        if (!r) throw new Error("no more canned replies");
        if (r instanceof Error) throw r;
        return { stop_reason: "end_turn", ...r };
      },
    },
  } as unknown as Anthropic;
  return { client, calls };
}
const out = (...items: { id: string; description?: string; tags: string[] }[]) => ({
  parsed_output: { events: items.map((i) => ({ description: "A fun thing.", ...i })) },
});

describe("buildTaggingInput", () => {
  it("includes only allowed fields and a NY time", () => {
    const line = buildTaggingInput([ev(1, { description: "x".repeat(900) })]);
    const obj = JSON.parse(line);
    expect(Object.keys(obj).sort()).toEqual(["description", "hints", "id", "location", "title", "when"]);
    expect(obj.when).toBe("Sat Nov 21, 7:30 PM");
    expect(obj.description.length).toBeLessThanOrEqual(500);
    expect(buildTaggingInput([ev(1), ev(2)]).split("\n")).toHaveLength(2);
  });
});

describe("tagBatch", () => {
  const [a, b] = [ev(1), ev(2)];

  it("happy path", async () => {
    const { client, calls } = fakeClient([out({ id: a.id, tags: ["music"] }, { id: b.id, tags: ["food", "drinks"] })]);
    const res = await tagBatch(client, [a, b], "instr");
    expect(res.map((r) => r.id)).toEqual([a.id, b.id]);
    expect(calls[0].system).toBe("instr");
    expect(calls[0].temperature).toBeUndefined();
  });

  it("ignores invented ids and duplicates", async () => {
    const { client } = fakeClient([out({ id: "f".repeat(16), tags: ["music"] }, { id: a.id, tags: ["music"] }, { id: a.id, tags: ["art"] })]);
    const res = await tagBatch(client, [a], "i");
    expect(res).toEqual([{ id: a.id, description: "A fun thing.", tags: ["music"] }]);
  });

  it("drops bad tags and items with none", async () => {
    const { client } = fakeClient([out({ id: a.id, tags: ["bogus", "art"] }, { id: b.id, tags: ["bogus"] }), out({ id: b.id, tags: ["bogus"] })]);
    const res = await tagBatch(client, [a, b], "i");
    expect(res).toHaveLength(1);
    expect(res[0].tags).toEqual(["art"]);
  });

  it("trims to 3 tags and truncates long descriptions", async () => {
    const long = "word ".repeat(100);
    const { client } = fakeClient([out({ id: a.id, description: long, tags: ["music", "art", "food", "film"] })]);
    const [r] = await tagBatch(client, [a], "i");
    expect(r.tags).toEqual(["music", "art", "food"]);
    expect(r.description.length).toBeLessThanOrEqual(300);
    expect(r.description.endsWith("word")).toBe(true);
  });

  it("retries missing events once", async () => {
    const { client, calls } = fakeClient([out({ id: a.id, tags: ["music"] }), out({ id: b.id, tags: ["food"] })]);
    const res = await tagBatch(client, [a, b], "i");
    expect(res.map((r) => r.id).sort()).toEqual([a.id, b.id]);
    expect(calls).toHaveLength(2);
    expect(calls[1].messages[0].content).not.toContain(a.id);
  });

  it("leaves events untagged if still missing after retry", async () => {
    const logs: string[] = [];
    const { client, calls } = fakeClient([out({ id: a.id, tags: ["music"] }), out()]);
    const res = await tagBatch(client, [a, b], "i", (m) => logs.push(m));
    expect(res).toHaveLength(1);
    expect(calls).toHaveLength(2);
    expect(logs.join("\n")).toContain("untagged");
  });

  it("skips a refused batch", async () => {
    const { client, calls } = fakeClient([{ stop_reason: "refusal" }]);
    expect(await tagBatch(client, [a, b], "i")).toEqual([]);
    expect(calls).toHaveLength(1);
  });

  it("splits the batch when the SDK throws a parse error for a truncated reply", async () => {
    const { client, calls } = fakeClient([new Anthropic.AnthropicError("Failed to parse structured output"), out({ id: a.id, tags: ["music"] }), out({ id: b.id, tags: ["art"] })]);
    const res = await tagBatch(client, [a, b], "i");
    expect(res).toHaveLength(2);
    expect(calls).toHaveLength(3);
  });

  it("skips a single event whose reply can't be parsed", async () => {
    const { client, calls } = fakeClient([new Anthropic.AnthropicError("Failed to parse structured output")]);
    expect(await tagBatch(client, [a], "i")).toEqual([]);
    expect(calls).toHaveLength(1);
  });

  it("splits the batch on stop_reason max_tokens too", async () => {
    const { client, calls } = fakeClient([{ stop_reason: "max_tokens" }, out({ id: a.id, tags: ["music"] }), out({ id: b.id, tags: ["art"] })]);
    expect(await tagBatch(client, [a, b], "i")).toHaveLength(2);
    expect(calls).toHaveLength(3);
  });

  it("explains authentication errors", async () => {
    const err = new Anthropic.AuthenticationError(401, {}, "bad key", new Headers());
    const { client } = fakeClient([err]);
    await expect(tagBatch(client, [a], "i")).rejects.toThrow(/ANTHROPIC_API_KEY/);
  });
});

describe("tagEvents", () => {
  it("calls onBatch per batch and stops on rate limit keeping progress", async () => {
    const events = [ev(1), ev(2), ev(3)];
    const rl = new Anthropic.RateLimitError(429, {}, "slow down", new Headers());
    const { client } = fakeClient([out({ id: events[0].id, tags: ["music"] }, { id: events[1].id, tags: ["art"] }), rl]);
    const batches: number[] = [];
    const res = await tagEvents(events, { client, batchSize: 2, onBatch: async (a) => void batches.push(a.length) });
    expect(res).toHaveLength(2);
    expect(batches).toEqual([2]);
  });

  it("rethrows bad requests", async () => {
    const err = new Anthropic.BadRequestError(400, {}, "nope", new Headers());
    const { client } = fakeClient([err]);
    await expect(tagEvents([ev(1)], { client })).rejects.toThrow();
  });
});

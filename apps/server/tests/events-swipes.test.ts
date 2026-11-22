import { beforeEach, describe, expect, it } from "vitest";
import { getPool } from "../src/db/pool.js";
import {
  api,
  describeDb,
  hoursFromNow,
  insertEvent,
  insertUser,
  makeFriends,
  resetDb,
  swipe,
} from "./helpers.js";

const CARD_KEYS = [
  "creatorId",
  "description",
  "expired",
  "friendsGoing",
  "id",
  "imageUrl",
  "lat",
  "lng",
  "location",
  "priceMax",
  "priceMin",
  "sourceUrl",
  "startsAt",
  "tags",
  "title",
].sort();

const UNKNOWN_UUID = "00000000-0000-4000-8000-000000000000";

function validEvent(overrides: Record<string, unknown> = {}) {
  return {
    title: "Jazz night",
    description: "Live jazz",
    tags: ["music", "drinks"],
    startsAt: hoursFromNow(24).toISOString(),
    location: "Wally's Cafe",
    lat: 42.3424,
    lng: -71.0806,
    imageUrl: "https://example.com/jazz.jpg",
    sourceUrl: "https://example.com/jazz",
    priceMin: 10,
    priceMax: 25.5,
    ...overrides,
  };
}

describeDb("events and swipes", () => {
  let ada: string;

  beforeEach(async () => {
    await resetDb();
    ada = await insertUser("Ada");
  });

  describe("POST /events", () => {
    it("creates a Card with JSON numbers and the creator going", async () => {
      const body = validEvent();
      const res = await api("POST", "/events", { userId: ada, body });
      expect(res.status).toBe(201);
      const card = res.body.event;
      expect(Date.parse(card.startsAt)).toBe(Date.parse(body.startsAt));
      expect(Object.keys(card).sort()).toEqual(CARD_KEYS);
      expect(card).toMatchObject({
        title: "Jazz night",
        tags: ["music", "drinks"],
        lat: 42.3424,
        lng: -71.0806,
        priceMin: 10,
        priceMax: 25.5,
        creatorId: ada,
        friendsGoing: 0,
        expired: false,
      });

      const going = await api("GET", "/me/going", { userId: ada });
      expect(going.body.events.map((e: { id: string }) => e.id)).toEqual([card.id]);
    });

    it("optional fields default to null", async () => {
      const res = await api("POST", "/events", {
        userId: ada,
        body: { title: "Pickup soccer", tags: ["sports"], startsAt: hoursFromNow(5).toISOString() },
      });
      expect(res.status).toBe(201);
      expect(res.body.event).toMatchObject({
        description: null,
        location: null,
        lat: null,
        lng: null,
        imageUrl: null,
        sourceUrl: null,
        priceMin: null,
        priceMax: null,
      });
    });

    it.each([
      ["startsAt in the past", { startsAt: hoursFromNow(-1).toISOString() }],
      ["startsAt not ISO", { startsAt: "tomorrow" }],
      ["tag not in TAGS", { tags: ["music", "knitting"] }],
      ["no tags", { tags: [] }],
      ["priceMin > priceMax", { priceMin: 30, priceMax: 10 }],
      ["negative price", { priceMin: -1 }],
      ["empty title", { title: "  " }],
      ["non-URL imageUrl", { imageUrl: "not a url" }],
    ])("%s -> 400", async (_label, overrides) => {
      const res = await api("POST", "/events", { userId: ada, body: validEvent(overrides) });
      expect(res).toEqual({ status: 400, body: { error: expect.any(String) } });
    });

    it("requires auth", async () => {
      expect((await api("POST", "/events", { body: validEvent() })).status).toBe(401);
    });
  });

  describe("GET /events/:id", () => {
    it("malformed id -> 400, unknown id -> 404", async () => {
      expect((await api("GET", "/events/not-a-uuid", { userId: ada })).status).toBe(400);
      const res = await api("GET", `/events/${UNKNOWN_UUID}`, { userId: ada });
      expect(res).toEqual({ status: 404, body: { error: expect.any(String) } });
    });

    it("going list: friends first then by name, viewer excluded, contacts only for friends", async () => {
      const zed = await insertUser("Zed", { contacts: { instagram: "@zed" } });
      const bob = await insertUser("Bob", { contacts: { instagram: "@bob" } });
      const amy = await insertUser("Amy", { contacts: { instagram: "@amy" } });
      const saver = await insertUser("Sam");
      await makeFriends(ada, zed);

      const eventId = await insertEvent({ startsAt: hoursFromNow(10), priceMin: 0, priceMax: 0 });
      for (const user of [ada, zed, bob, amy]) await swipe(user, eventId, "going");
      await swipe(saver, eventId, "save");

      const res = await api("GET", `/events/${eventId}`, { userId: ada });
      expect(res.status).toBe(200);
      expect(res.body.event).toMatchObject({ id: eventId, friendsGoing: 1, priceMin: 0, priceMax: 0, expired: false });
      expect(res.body.going).toEqual([
        { id: zed, name: "Zed", isFriend: true, contacts: { instagram: "@zed" } },
        { id: amy, name: "Amy", isFriend: false },
        { id: bob, name: "Bob", isFriend: false },
      ]);
    });

    it("expired event -> expired: true", async () => {
      const eventId = await insertEvent({ startsAt: hoursFromNow(-2) });
      const res = await api("GET", `/events/${eventId}`, { userId: ada });
      expect(res.body.event.expired).toBe(true);
    });
  });

  describe("POST /swipes", () => {
    it("upserts: save then going leaves one row and the going list reflects it", async () => {
      const bob = await insertUser("Bob");
      const eventId = await insertEvent({ startsAt: hoursFromNow(10) });

      const saved = await api("POST", "/swipes", { userId: bob, body: { eventId, action: "save" } });
      expect(saved).toEqual({ status: 200, body: { swipe: { eventId, action: "save" } } });
      expect((await api("GET", `/events/${eventId}`, { userId: ada })).body.going).toEqual([]);

      const going = await api("POST", "/swipes", { userId: bob, body: { eventId, action: "going" } });
      expect(going.body).toEqual({ swipe: { eventId, action: "going" } });

      const { rows } = await getPool().query("SELECT action FROM swipes WHERE user_id = $1", [bob]);
      expect(rows).toEqual([{ action: "going" }]);
      expect((await api("GET", `/events/${eventId}`, { userId: ada })).body.going.map((u: { id: string }) => u.id)).toEqual([bob]);
    });

    it("missing event -> 404, malformed eventId or bad action -> 400", async () => {
      const missing = await api("POST", "/swipes", { userId: ada, body: { eventId: UNKNOWN_UUID, action: "save" } });
      expect(missing).toEqual({ status: 404, body: { error: expect.any(String) } });
      expect((await api("POST", "/swipes", { userId: ada, body: { eventId: "nope", action: "save" } })).status).toBe(400);
      const eventId = await insertEvent({ startsAt: hoursFromNow(10) });
      expect((await api("POST", "/swipes", { userId: ada, body: { eventId, action: "love" } })).status).toBe(400);
    });
  });

  describe("/me/saved and /me/going", () => {
    it("list by action, ordered by startsAt, including expired events", async () => {
      const later = await insertEvent({ title: "later", startsAt: hoursFromNow(48) });
      const past = await insertEvent({ title: "past", startsAt: hoursFromNow(-48) });
      const soon = await insertEvent({ title: "soon", startsAt: hoursFromNow(2) });
      const goingEvent = await insertEvent({ title: "going", startsAt: hoursFromNow(-1) });
      const passed = await insertEvent({ title: "passed", startsAt: hoursFromNow(3) });

      await swipe(ada, later, "save");
      await swipe(ada, past, "save");
      await swipe(ada, soon, "save");
      await swipe(ada, goingEvent, "going");
      await swipe(ada, passed, "pass");

      const saved = await api("GET", "/me/saved", { userId: ada });
      expect(saved.status).toBe(200);
      expect(saved.body.events.map((e: { title: string; expired: boolean }) => [e.title, e.expired])).toEqual([
        ["past", true],
        ["soon", false],
        ["later", false],
      ]);
      for (const card of saved.body.events) expect(Object.keys(card).sort()).toEqual(CARD_KEYS);

      const going = await api("GET", "/me/going", { userId: ada });
      expect(going.body.events.map((e: { title: string; expired: boolean }) => [e.title, e.expired])).toEqual([
        ["going", true],
      ]);
    });

    it("friendsGoing counts only accepted friends going", async () => {
      const friend = await insertUser("Fran");
      const pending = await insertUser("Pete");
      const stranger = await insertUser("Stan");
      await makeFriends(ada, friend);
      await api("POST", "/friends/requests", { userId: pending, body: { userId: ada } });

      const eventId = await insertEvent({ startsAt: hoursFromNow(10), priceMin: 5.25, priceMax: 12 });
      for (const user of [friend, pending, stranger]) await swipe(user, eventId, "going");
      await swipe(ada, eventId, "save");

      const [card] = (await api("GET", "/me/saved", { userId: ada })).body.events;
      expect(card).toMatchObject({ friendsGoing: 1, priceMin: 5.25, priceMax: 12 });
      expect(typeof card.friendsGoing).toBe("number");
    });
  });
});

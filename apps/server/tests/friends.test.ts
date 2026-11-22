import { beforeEach, describe, expect, it } from "vitest";
import {
  api,
  describeDb,
  friendRows,
  hoursFromNow,
  insertEvent,
  insertUser,
  makeFriends,
  resetDb,
  swipe,
} from "./helpers.js";

const UNKNOWN_UUID = "00000000-0000-4000-8000-000000000000";

describeDb("friends and user search", () => {
  let ada: string;
  let bob: string;

  beforeEach(async () => {
    await resetDb();
    ada = await insertUser("Ada", { email: "ada@example.com", contacts: { instagram: "@ada" } });
    bob = await insertUser("Bob", { email: "bob@example.com", contacts: { phone: "555-0100" } });
  });

  const request = (from: string, to: string) => api("POST", "/friends/requests", { userId: from, body: { userId: to } });
  const accept = (me: string, from: string) => api("POST", `/friends/requests/${from}/accept`, { userId: me });

  describe("POST /friends/requests", () => {
    it("new request -> 201 requested, stores one 'requested' row", async () => {
      expect(await request(ada, bob)).toEqual({ status: 201, body: { status: "requested" } });
      expect(await friendRows()).toEqual([`${ada}->${bob}:requested`]);
    });

    it("repeating my own request is idempotent", async () => {
      await request(ada, bob);
      expect(await request(ada, bob)).toEqual({ status: 201, body: { status: "requested" } });
      expect(await friendRows()).toEqual([`${ada}->${bob}:requested`]);
    });

    it("requesting someone who already requested me auto-accepts (both rows)", async () => {
      await request(bob, ada);
      expect(await request(ada, bob)).toEqual({ status: 201, body: { status: "accepted" } });
      expect(await friendRows()).toEqual([`${ada}->${bob}:accepted`, `${bob}->${ada}:accepted`].sort());
    });

    it("self -> 400, unknown user -> 404, malformed id -> 400", async () => {
      expect((await request(ada, ada)).status).toBe(400);
      expect(await request(ada, UNKNOWN_UUID)).toEqual({ status: 404, body: { error: expect.any(String) } });
      expect((await request(ada, "not-a-uuid")).status).toBe(400);
    });

    it("already friends -> 409 (from either side)", async () => {
      await makeFriends(ada, bob);
      expect((await request(ada, bob)).status).toBe(409);
      expect((await request(bob, ada)).status).toBe(409);
    });
  });

  describe("accept", () => {
    it("accept creates both accepted rows and returns the friend with contacts", async () => {
      await request(bob, ada);
      const res = await accept(ada, bob);
      expect(res).toEqual({
        status: 200,
        body: { friend: { id: bob, name: "Bob", isFriend: true, contacts: { phone: "555-0100" } } },
      });
      expect(await friendRows()).toEqual([`${ada}->${bob}:accepted`, `${bob}->${ada}:accepted`].sort());
    });

    it("no pending request -> 404 (including accepting my own outgoing request)", async () => {
      expect((await accept(ada, bob)).status).toBe(404);
      await request(ada, bob);
      expect((await accept(ada, bob)).status).toBe(404);
      expect((await accept(ada, "not-a-uuid")).status).toBe(400);
    });

    it("accepting twice -> 404 the second time", async () => {
      await request(bob, ada);
      await accept(ada, bob);
      expect((await accept(ada, bob)).status).toBe(404);
    });
  });

  describe("contact privacy", () => {
    it("requests hide contacts; /friends shows them", async () => {
      await request(bob, ada);
      const adaRequests = await api("GET", "/friends/requests", { userId: ada });
      expect(adaRequests.body).toEqual({ incoming: [{ id: bob, name: "Bob", isFriend: false }], outgoing: [] });
      const bobRequests = await api("GET", "/friends/requests", { userId: bob });
      expect(bobRequests.body).toEqual({ incoming: [], outgoing: [{ id: ada, name: "Ada", isFriend: false }] });
      expect((await api("GET", "/friends", { userId: ada })).body).toEqual({ friends: [] });

      await accept(ada, bob);
      expect((await api("GET", "/friends", { userId: ada })).body).toEqual({
        friends: [{ id: bob, name: "Bob", isFriend: true, contacts: { phone: "555-0100" } }],
      });
      expect((await api("GET", "/friends", { userId: bob })).body).toEqual({
        friends: [{ id: ada, name: "Ada", isFriend: true, contacts: { instagram: "@ada" } }],
      });
      expect((await api("GET", "/friends/requests", { userId: ada })).body).toEqual({ incoming: [], outgoing: [] });
    });

    it("/friends is ordered by name", async () => {
      const zed = await insertUser("Zed");
      const amy = await insertUser("Amy");
      await makeFriends(ada, zed);
      await makeFriends(amy, ada);
      await makeFriends(ada, bob);
      const names = (await api("GET", "/friends", { userId: ada })).body.friends.map((f: { name: string }) => f.name);
      expect(names).toEqual(["Amy", "Bob", "Zed"]);
    });
  });

  describe("GET /friends/events", () => {
    it("shows upcoming events friends are going to, never saves, never expired", async () => {
      const cat = await insertUser("Cat");
      const stranger = await insertUser("Stan");
      await makeFriends(ada, bob);
      await makeFriends(ada, cat);

      const later = await insertEvent({ title: "later", startsAt: hoursFromNow(30) });
      const soon = await insertEvent({ title: "soon", startsAt: hoursFromNow(3) });
      const savedOnly = await insertEvent({ title: "saved-only", startsAt: hoursFromNow(5) });
      const expired = await insertEvent({ title: "expired", startsAt: hoursFromNow(-3) });
      const strangerOnly = await insertEvent({ title: "stranger-only", startsAt: hoursFromNow(6) });

      await swipe(cat, later, "going");
      await swipe(bob, later, "going");
      await swipe(bob, soon, "going");
      await swipe(bob, savedOnly, "save");
      await swipe(cat, expired, "going");
      await swipe(stranger, strangerOnly, "going");

      const res = await api("GET", "/friends/events", { userId: ada });
      expect(res.status).toBe(200);
      expect(res.body.events.map((e: { title: string; friendsGoing: number; expired: boolean; goingFriends: unknown }) => ({
        title: e.title,
        friendsGoing: e.friendsGoing,
        expired: e.expired,
        goingFriends: e.goingFriends,
      }))).toEqual([
        { title: "soon", friendsGoing: 1, expired: false, goingFriends: [{ id: bob, name: "Bob" }] },
        {
          title: "later",
          friendsGoing: 2,
          expired: false,
          goingFriends: [
            { id: bob, name: "Bob" },
            { id: cat, name: "Cat" },
          ],
        },
      ]);
    });

    it("pending (not accepted) friends' events don't show", async () => {
      await request(bob, ada);
      await swipe(bob, await insertEvent({ startsAt: hoursFromNow(3) }), "going");
      expect((await api("GET", "/friends/events", { userId: ada })).body).toEqual({ events: [] });
    });
  });

  describe("GET /users/search", () => {
    const search = (viewer: string, q: string) =>
      api("GET", `/users/search?q=${encodeURIComponent(q)}`, { userId: viewer });

    it("name substring (case-insensitive) matches, without contacts for non-friends", async () => {
      const res = await search(ada, "bo");
      expect(res).toEqual({ status: 200, body: { users: [{ id: bob, name: "Bob", isFriend: false }] } });
    });

    it("friends in results carry contacts", async () => {
      await makeFriends(ada, bob);
      expect((await search(ada, "BOB")).body.users).toEqual([
        { id: bob, name: "Bob", isFriend: true, contacts: { phone: "555-0100" } },
      ]);
    });

    it("email substring does NOT match; exact email (any case, padded) does (A4)", async () => {
      expect((await search(ada, "example.com")).body.users).toEqual([]);
      expect((await search(ada, "bob@example")).body.users).toEqual([]);
      expect((await search(ada, "  BOB@example.com ")).body.users.map((u: { id: string }) => u.id)).toEqual([bob]);
    });

    it("excludes the viewer", async () => {
      expect((await search(ada, "Ada")).body.users).toEqual([]);
      expect((await search(ada, "ada@example.com")).body.users).toEqual([]);
    });

    it("treats % and _ literally", async () => {
      const percent = await insertUser("100% Real");
      await insertUser("100X Real");
      expect((await search(ada, "0%")).body.users.map((u: { id: string }) => u.id)).toEqual([percent]);
      expect((await search(ada, "%%")).body.users).toEqual([]);
      expect((await search(ada, "0_")).body.users).toEqual([]);
    });

    it("orders by name and limits to 20", async () => {
      for (let i = 25; i > 0; i--) await insertUser(`Member ${String(i).padStart(2, "0")}`);
      const users = (await search(ada, "member")).body.users;
      expect(users).toHaveLength(20);
      expect(users[0].name).toBe("Member 01");
      expect(users[19].name).toBe("Member 20");
    });

    it("q shorter than 2 or longer than 100 chars -> 400", async () => {
      expect((await search(ada, "b")).status).toBe(400);
      expect((await search(ada, "x".repeat(101))).status).toBe(400);
      expect((await api("GET", "/users/search", { userId: ada })).status).toBe(400);
    });

    it("NUL character in q -> 400, not a pg 500", async () => {
      expect(await search(ada, "bo\u0000b")).toEqual({ status: 400, body: { error: expect.any(String) } });
    });
  });
});

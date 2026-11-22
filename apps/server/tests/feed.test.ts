import { randomUUID } from "node:crypto";
import { beforeEach, expect, it } from "vitest";
import { api, describeDb, hoursFromNow, insertEvent, insertUser, makeFriends, resetDb, swipe } from "./helpers.js";

describeDb("GET /feed", () => {
  let ada: string;

  beforeEach(async () => {
    await resetDb();
    ada = await insertUser("Ada");
  });

  const feed = (query = "") => api("GET", `/feed${query}`, { userId: ada });
  const feedIds = async (query = "") => {
    const res = await feed(query);
    expect(res.status).toBe(200);
    return res.body.events.map((e: { id: string }) => e.id).sort();
  };

  it("only unswiped events in the next 7 days, minus excluded ids", async () => {
    const soon = await insertEvent({ title: "soon", startsAt: hoursFromNow(1) });
    const sixDays = await insertEvent({ title: "six days", startsAt: hoursFromNow(6 * 24) });
    const excluded = await insertEvent({ title: "excluded", startsAt: hoursFromNow(3) });
    await insertEvent({ title: "eight days", startsAt: hoursFromNow(8 * 24) });
    await insertEvent({ title: "expired", startsAt: hoursFromNow(-1) });
    for (const action of ["pass", "save", "going", "removed"]) {
      await swipe(ada, await insertEvent({ title: action, startsAt: hoursFromNow(2) }), action);
    }

    expect(await feedIds(`?exclude=${excluded}`)).toEqual([soon, sixDays].sort());
    expect(await feedIds()).toEqual([soon, sixDays, excluded].sort());
  });

  it("other users' swipes don't hide events from me", async () => {
    const bob = await insertUser("Bob");
    const eventId = await insertEvent({ startsAt: hoursFromNow(5) });
    await swipe(bob, eventId, "pass");
    expect(await feedIds()).toEqual([eventId]);
  });

  it("returns Cards with friendsGoing and no scores", async () => {
    const bob = await insertUser("Bob");
    await makeFriends(ada, bob);
    const eventId = await insertEvent({ startsAt: hoursFromNow(5), priceMin: 0, priceMax: 0 });
    await swipe(bob, eventId, "going");

    const [card] = (await feed()).body.events;
    expect(card).toMatchObject({ id: eventId, friendsGoing: 1, priceMin: 0, priceMax: 0, expired: false });
    expect(Object.keys(card)).not.toContain("score");
  });

  it("interests rank matching events first", async () => {
    await api("PATCH", "/me", { userId: ada, body: { interests: ["tech"] } });
    const plain = await insertEvent({ title: "plain", tags: ["music"], startsAt: hoursFromNow(24) });
    const tech = await insertEvent({ title: "tech", tags: ["tech"], startsAt: hoursFromNow(24) });
    const ids = (await feed()).body.events.map((e: { id: string }) => e.id);
    expect(ids).toEqual([tech, plain]);
  });

  it("empty exclude is fine; malformed or too many exclude ids -> 400", async () => {
    expect((await feed("?exclude=")).status).toBe(200);
    expect(await feed("?exclude=not-a-uuid")).toEqual({ status: 400, body: { error: expect.any(String) } });
    expect((await feed(`?exclude=${randomUUID()},bad`)).status).toBe(400);
    const tooMany = Array.from({ length: 201 }, () => randomUUID()).join(",");
    expect((await feed(`?exclude=${tooMany}`)).status).toBe(400);
    const max = Array.from({ length: 200 }, () => randomUUID()).join(",");
    expect((await feed(`?exclude=${max}`)).status).toBe(200);
  });

  it("requires auth", async () => {
    expect((await api("GET", "/feed")).status).toBe(401);
  });
});

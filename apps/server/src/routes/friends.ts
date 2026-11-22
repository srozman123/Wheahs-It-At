import { Hono } from "hono";
import { z } from "zod";
import { listFriendsGoingEvents } from "../db/events.js";
import { requireUser, type AuthedEnv } from "../middleware/requireUser.js";
import { acceptFriend, listFriends, listRequests, sendRequest } from "../services/friends.js";
import { validate } from "../validation.js";

const requestSchema = z.object({ userId: z.uuid() });
const userIdParam = z.object({ userId: z.uuid() });

export const friendsRoutes = new Hono<AuthedEnv>()
  .use(requireUser)
  .get("/", async (c) => c.json({ friends: await listFriends(c.var.userId) }))
  .get("/requests", async (c) => c.json(await listRequests(c.var.userId)))
  .post("/requests", validate("json", requestSchema), async (c) => {
    const { userId } = c.req.valid("json");
    return c.json({ status: await sendRequest(c.var.userId, userId) }, 201);
  })
  .post("/requests/:userId/accept", validate("param", userIdParam), async (c) => {
    const { userId } = c.req.valid("param");
    return c.json({ friend: await acceptFriend(c.var.userId, userId) });
  })
  .get("/events", async (c) => c.json({ events: await listFriendsGoingEvents(c.var.userId) }));

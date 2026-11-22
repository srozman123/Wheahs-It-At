import { Hono } from "hono";
import { z } from "zod";
import { searchUsers } from "../db/users.js";
import { requireUser, type AuthedEnv } from "../middleware/requireUser.js";
import { toPublicUsers } from "../services/friends.js";
import { safeString, validate } from "../validation.js";

const searchSchema = z.object({ q: safeString.trim().min(2).max(100) });

export const usersRoutes = new Hono<AuthedEnv>()
  .use(requireUser)
  .get("/search", validate("query", searchSchema), async (c) => {
    const { q } = c.req.valid("query");
    const users = await searchUsers(c.var.userId, q);
    return c.json({ users: await toPublicUsers(c.var.userId, users) });
  });

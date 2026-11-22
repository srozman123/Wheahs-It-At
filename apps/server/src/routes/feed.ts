import { Hono } from "hono";
import { z } from "zod";
import { requireUser, type AuthedEnv } from "../middleware/requireUser.js";
import { getFeed } from "../services/feed.js";
import { validate } from "../validation.js";

const MAX_EXCLUDED = 200;

// "a,b,c" -> ["a","b","c"]; missing or empty means nothing excluded.
const excludeIds = z
  .string()
  .optional()
  .transform((value) => (value ? value.split(",").map((id) => id.trim()) : []))
  .pipe(z.array(z.uuid()).max(MAX_EXCLUDED));

export const feedRoutes = new Hono<AuthedEnv>()
  .use(requireUser)
  .get("/", validate("query", z.object({ exclude: excludeIds })), async (c) => {
    const { exclude } = c.req.valid("query");
    return c.json({ events: await getFeed(c.var.userId, exclude) });
  });

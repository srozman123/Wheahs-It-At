import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { upsertSwipe } from "../db/swipes.js";
import { getPool } from "../db/pool.js";
import { requireUser, type AuthedEnv } from "../middleware/requireUser.js";
import { validate } from "../validation.js";

const swipeSchema = z.object({
  eventId: z.uuid(),
  action: z.enum(["pass", "save", "going", "removed"]),
});

export const swipesRoutes = new Hono<AuthedEnv>()
  .use(requireUser)
  .post("/", validate("json", swipeSchema), async (c) => {
    const { eventId, action } = c.req.valid("json");
    const swipe = await upsertSwipe(getPool(), c.var.userId, eventId, action);
    if (!swipe) {
      throw new HTTPException(404, { message: "Event not found" });
    }
    return c.json({ swipe });
  });

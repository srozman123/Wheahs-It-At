import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { createEvent, getCardById, listGoingUsers } from "../db/events.js";
import { requireUser, type AuthedEnv } from "../middleware/requireUser.js";
import { toPublicUsers } from "../services/friends.js";
import { eventTagsSchema, safeString, validate, withoutNul } from "../validation.js";

// Matches NUMERIC(8,2).
const price = z.number().min(0).max(999999.99);
const httpUrl = z.url({ protocol: /^https?$/ }).refine(...withoutNul);

const newEventSchema = z
  .object({
    title: safeString.trim().min(1).max(200),
    description: safeString.max(5000).optional(),
    tags: eventTagsSchema,
    startsAt: z.iso
      .datetime({ offset: true })
      .refine((value) => new Date(value).getTime() > Date.now(), "must be in the future"),
    location: safeString.max(300).optional(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    imageUrl: httpUrl.optional(),
    sourceUrl: httpUrl.optional(),
    priceMin: price.optional(),
    priceMax: price.optional(),
  })
  .refine(
    ({ priceMin, priceMax }) => priceMin === undefined || priceMax === undefined || priceMin <= priceMax,
    { message: "priceMin must be <= priceMax", path: ["priceMin"] },
  );

const eventIdParam = z.object({ id: z.uuid() });

export const eventsRoutes = new Hono<AuthedEnv>()
  .use(requireUser)
  .get("/:id", validate("param", eventIdParam), async (c) => {
    const { id } = c.req.valid("param");
    const viewerId = c.var.userId;
    const event = await getCardById(viewerId, id);
    if (!event) {
      throw new HTTPException(404, { message: "Event not found" });
    }
    const going = await toPublicUsers(viewerId, await listGoingUsers(id, viewerId));
    // Stable sort keeps the by-name order within each group.
    going.sort((a, b) => Number(b.isFriend) - Number(a.isFriend));
    return c.json({ event, going });
  })
  .post("/", validate("json", newEventSchema), async (c) => {
    return c.json({ event: await createEvent(c.var.userId, c.req.valid("json")) }, 201);
  });

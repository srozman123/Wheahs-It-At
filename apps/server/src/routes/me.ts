import { Hono } from "hono";
import { z } from "zod";
import { listCardsBySwipeAction } from "../db/events.js";
import { findMeById, updateMe, type Contacts } from "../db/users.js";
import { requireUser, type AuthedEnv } from "../middleware/requireUser.js";
import { interestsSchema, safeString, validate } from "../validation.js";

const contactValue = safeString.trim().max(200);

const patchMeSchema = z.object({
  name: safeString.trim().min(1).max(80).optional(),
  contacts: z
    .strictObject({
      instagram: contactValue.optional(),
      snapchat: contactValue.optional(),
      phone: contactValue.optional(),
      email: contactValue.optional(),
    })
    .optional(),
  interests: interestsSchema.optional(),
});

function dropEmptyValues(contacts: Contacts): Contacts {
  return Object.fromEntries(Object.entries(contacts).filter(([, value]) => value !== "")) as Contacts;
}

export const meRoutes = new Hono<AuthedEnv>()
  .use(requireUser)
  .get("/", async (c) => {
    // requireUser has confirmed the user exists.
    return c.json({ user: await findMeById(c.var.userId) });
  })
  .patch("/", validate("json", patchMeSchema), async (c) => {
    const { name, contacts, interests } = c.req.valid("json");
    const user = await updateMe(c.var.userId, {
      name,
      contacts: contacts && dropEmptyValues(contacts),
      interests,
    });
    return c.json({ user });
  })
  .get("/saved", async (c) => c.json({ events: await listCardsBySwipeAction(c.var.userId, "save") }))
  .get("/going", async (c) => c.json({ events: await listCardsBySwipeAction(c.var.userId, "going") }));

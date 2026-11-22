import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { userExists } from "../db/users.js";

export type AuthedEnv = { Variables: { userId: string } };

const userIdSchema = z.uuid();

export const requireUser = createMiddleware<AuthedEnv>(async (c, next) => {
  const parsed = userIdSchema.safeParse(c.req.header("x-user-id"));
  if (!parsed.success || !(await userExists(parsed.data))) {
    throw new HTTPException(401, { message: "Not logged in" });
  }
  c.set("userId", parsed.data);
  await next();
});

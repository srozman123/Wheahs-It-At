import { Hono } from "hono";
import { z } from "zod";
import { login, signup } from "../services/auth.js";
import { emailSchema, validate } from "../validation.js";

// Seed accounts are created by scripts only.
const SEED_DOMAIN = "@seed.test";

const signupSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: emailSchema.refine((email) => !email.endsWith(SEED_DOMAIN), "Email domain not allowed"),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});

export const authRoutes = new Hono()
  .post("/signup", validate("json", signupSchema), async (c) => {
    const { name, email, password } = c.req.valid("json");
    return c.json({ user: await signup(name, email, password) }, 201);
  })
  .post("/login", validate("json", loginSchema), async (c) => {
    const { email, password } = c.req.valid("json");
    return c.json({ user: await login(email, password) });
  });

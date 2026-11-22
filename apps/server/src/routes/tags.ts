import { Hono } from "hono";
import { TAGS } from "../tags.js";

export const tagsRoutes = new Hono().get("/", (c) => c.json({ tags: TAGS }));

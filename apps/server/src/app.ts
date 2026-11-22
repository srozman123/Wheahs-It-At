import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { tagsRoutes } from "./routes/tags.js";

export function createApp(): Hono {
  const app = new Hono();

  app.use(cors());

  app.get("/health", (c) => c.json({ ok: true }));
  app.route("/tags", tagsRoutes);

  // Mount points for the remaining routers:
  // public: /auth. Behind requireUser: /me, /feed, /events, /swipes, /friends, /users.

  app.notFound((c) => c.json({ error: "Not found" }, 404));

  app.onError((error, c) => {
    if (error instanceof HTTPException) {
      return c.json({ error: error.message }, error.status);
    }
    console.error(error);
    return c.json({ error: "Internal error" }, 500);
  });

  return app;
}

import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { authRoutes } from "./routes/auth.js";
import { eventsRoutes } from "./routes/events.js";
import { feedRoutes } from "./routes/feed.js";
import { friendsRoutes } from "./routes/friends.js";
import { meRoutes } from "./routes/me.js";
import { swipesRoutes } from "./routes/swipes.js";
import { tagsRoutes } from "./routes/tags.js";
import { usersRoutes } from "./routes/users.js";

export function createApp(): Hono {
  const app = new Hono();

  app.use(cors());

  app.get("/health", (c) => c.json({ ok: true }));
  app.route("/tags", tagsRoutes);
  app.route("/auth", authRoutes);
  app.route("/me", meRoutes);
  app.route("/events", eventsRoutes);
  app.route("/swipes", swipesRoutes);
  app.route("/friends", friendsRoutes);
  app.route("/users", usersRoutes);
  app.route("/feed", feedRoutes);

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

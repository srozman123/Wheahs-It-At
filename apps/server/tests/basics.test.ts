import { existsSync } from "node:fs";
import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { requireUser, type AuthedEnv } from "../src/middleware/requireUser.js";
import { TAGS } from "../src/tags.js";
import { api, describeDb, insertUser, resetDb } from "./helpers.js";

describe("harness", () => {
  it("passes the per-run test schema to workers", () => {
    expect(process.env.DB_SCHEMA).toMatch(/^wia_test_\d+$/);
  });
});

describe("public basics", () => {
  it("GET /health -> {ok:true}", async () => {
    const res = await api("GET", "/health");
    expect(res).toEqual({ status: 200, body: { ok: true } });
  });

  it("GET /tags -> every tag", async () => {
    const res = await api("GET", "/tags");
    expect(res).toEqual({ status: 200, body: { tags: [...TAGS] } });
  });

  it("unknown route -> 404 JSON error", async () => {
    const res = await api("GET", "/definitely-not-a-route");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: expect.any(String) });
  });
});

// requireUser isn't mounted on a real route yet, so test it on a minimal app
// that uses the real app's error handling (onError) for the 401 body.
function appWithProtectedRoute(): Hono {
  const app = createApp();
  app.get("/__protected", requireUser, (c) => c.json({ userId: (c as any).var.userId }));
  return app;
}

async function callProtected(userId?: string) {
  const headers: Record<string, string> = userId === undefined ? {} : { "x-user-id": userId };
  const response = await appWithProtectedRoute().request("/__protected", { headers });
  return { status: response.status, body: await response.json() };
}

describe("requireUser (no DB)", () => {
  it("missing x-user-id -> 401", async () => {
    expect(await callProtected()).toEqual({ status: 401, body: { error: expect.any(String) } });
  });

  it("malformed uuid -> 401, not a pg 500", async () => {
    expect(await callProtected("not-a-uuid")).toEqual({ status: 401, body: { error: expect.any(String) } });
  });
});

describeDb("requireUser (DB)", () => {
  beforeEach(resetDb);

  it("unknown uuid -> 401", async () => {
    const res = await callProtected("00000000-0000-4000-8000-000000000000");
    expect(res).toEqual({ status: 401, body: { error: expect.any(String) } });
  });

  it("known user -> passes through with c.var.userId", async () => {
    const id = await insertUser("Ada");
    expect(await callProtected(id)).toEqual({ status: 200, body: { userId: id } });
  });
});

const authRouteExists = existsSync(new URL("../src/routes/auth.ts", import.meta.url));

describe.skipIf(!authRouteExists)("POST /auth/signup validation (no DB)", () => {
  it.each([
    ["empty body", {}],
    ["short password", { name: "Ada", email: "ada@example.com", password: "short" }],
    ["bad email", { name: "Ada", email: "not-an-email", password: "password123" }],
    ["empty name", { name: "", email: "ada@example.com", password: "password123" }],
  ])("%s -> 400 {error}", async (_label, body) => {
    const res = await api("POST", "/auth/signup", { body });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: expect.any(String) });
  });
});

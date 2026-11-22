import { beforeEach, expect, it } from "vitest";
import { api, describeDb, insertUser, resetDb } from "./helpers.js";

describeDb("/me", () => {
  let me: string;

  beforeEach(async () => {
    await resetDb();
    me = await insertUser("Ada", { email: "ada@example.com" });
  });

  const patch = (body: unknown) => api("PATCH", "/me", { userId: me, body });

  it("GET /me -> Me without password_hash", async () => {
    const res = await api("GET", "/me", { userId: me });
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({
      id: me,
      name: "Ada",
      email: "ada@example.com",
      contacts: {},
      interests: [],
      createdAt: expect.any(String),
    });
  });

  it("GET /me without auth -> 401", async () => {
    expect((await api("GET", "/me")).status).toBe(401);
  });

  it("PATCH /me updates name and interests, leaves omitted fields alone", async () => {
    await patch({ contacts: { instagram: "@ada" } });
    const res = await patch({ name: "  Ada L  ", interests: ["music", "tech"] });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ name: "Ada L", interests: ["music", "tech"], contacts: { instagram: "@ada" } });
    expect((await api("GET", "/me", { userId: me })).body.user).toEqual(res.body.user);
  });

  it("PATCH /me interests: [] clears them", async () => {
    await patch({ interests: ["music"] });
    expect((await patch({ interests: [] })).body.user.interests).toEqual([]);
  });

  it("contacts replace the whole object; empty strings are dropped (A7)", async () => {
    await patch({ contacts: { instagram: "@ada", snapchat: "ada_snap" } });
    const res = await patch({ contacts: { phone: "555-0100", instagram: "", snapchat: "   " } });
    expect(res.status).toBe(200);
    expect(res.body.user.contacts).toEqual({ phone: "555-0100" });
  });

  it("unknown contact key -> 400", async () => {
    const res = await patch({ contacts: { tiktok: "@ada" } });
    expect(res).toEqual({ status: 400, body: { error: expect.any(String) } });
  });

  it("interest not in TAGS -> 400", async () => {
    const res = await patch({ interests: ["music", "knitting"] });
    expect(res).toEqual({ status: 400, body: { error: expect.any(String) } });
  });

  it("empty name -> 400", async () => {
    expect((await patch({ name: "   " })).status).toBe(400);
  });
});

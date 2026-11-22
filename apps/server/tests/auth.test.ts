import { beforeEach, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { getPool } from "../src/db/pool.js";
import { api, describeDb, resetDb, TEST_PASSWORD } from "./helpers.js";

const ME_KEYS = ["contacts", "createdAt", "email", "id", "interests", "name"];

function signupBody(email: string, name = "Ada") {
  return { name, email, password: TEST_PASSWORD };
}

describeDb("auth", () => {
  beforeEach(resetDb);

  it("signup -> 201 Me, then login with the same credentials -> 200 Me", async () => {
    const signup = await api("POST", "/auth/signup", { body: signupBody("ada@example.com") });
    expect(signup.status).toBe(201);
    expect(Object.keys(signup.body.user).sort()).toEqual(ME_KEYS);
    expect(signup.body.user).toMatchObject({
      name: "Ada",
      email: "ada@example.com",
      contacts: {},
      interests: [],
    });
    expect(Number.isNaN(Date.parse(signup.body.user.createdAt))).toBe(false);

    const login = await api("POST", "/auth/login", { body: { email: "ada@example.com", password: TEST_PASSWORD } });
    expect(login).toEqual({ status: 200, body: { user: signup.body.user } });
  });

  it("stores the password as a bcrypt hash", async () => {
    await api("POST", "/auth/signup", { body: signupBody("ada@example.com") });
    const { rows } = await getPool().query("SELECT password_hash FROM users");
    expect(rows[0].password_hash).toMatch(/^\$2[aby]\$10\$/);
  });

  it("trims + lowercases email on signup and login (A6)", async () => {
    const signup = await api("POST", "/auth/signup", { body: signupBody("  Ada@Example.COM  ") });
    expect(signup.status).toBe(201);
    expect(signup.body.user.email).toBe("ada@example.com");

    const login = await api("POST", "/auth/login", { body: { email: " ADA@example.com ", password: TEST_PASSWORD } });
    expect(login.status).toBe(200);
    expect(login.body.user.id).toBe(signup.body.user.id);
  });

  it("duplicate email (in any case) -> 409", async () => {
    await api("POST", "/auth/signup", { body: signupBody("ada@example.com") });
    const dup = await api("POST", "/auth/signup", { body: signupBody("ADA@example.com", "Other") });
    expect(dup).toEqual({ status: 409, body: { error: expect.any(String) } });
  });

  it("@seed.test emails are rejected -> 400 (A6)", async () => {
    for (const email of ["bob@seed.test", "  Bob@SEED.test "]) {
      const res = await api("POST", "/auth/signup", { body: signupBody(email) });
      expect(res).toEqual({ status: 400, body: { error: expect.any(String) } });
    }
  });

  it("wrong password and unknown email -> identical 401", async () => {
    await api("POST", "/auth/signup", { body: signupBody("ada@example.com") });
    const wrongPassword = await api("POST", "/auth/login", {
      body: { email: "ada@example.com", password: "wrong-password" },
    });
    const unknownEmail = await api("POST", "/auth/login", {
      body: { email: "nobody@example.com", password: TEST_PASSWORD },
    });
    expect(wrongPassword).toEqual({ status: 401, body: { error: "Invalid email or password" } });
    expect(unknownEmail).toEqual(wrongPassword);
  });

  it("unknown email (no stored hash to compare) still -> the same 401, every time", async () => {
    for (const email of ["nobody@example.com", "other@example.com"]) {
      const res = await api("POST", "/auth/login", { body: { email, password: TEST_PASSWORD } });
      expect(res).toEqual({ status: 401, body: { error: "Invalid email or password" } });
    }
  });

  it("NUL character in name or password -> 400, not a pg 500", async () => {
    for (const body of [signupBody("ada@example.com", "Ada\u0000"), { ...signupBody("ada@example.com"), password: "pass\u0000word" }]) {
      const res = await api("POST", "/auth/signup", { body });
      expect(res).toEqual({ status: 400, body: { error: expect.any(String) } });
    }
    const login = await api("POST", "/auth/login", { body: { email: "ada@example.com", password: "a\u0000" } });
    expect(login.status).toBe(400);
    for (const path of ["/auth/signup", "/auth/login"]) {
      const res = await api("POST", path, { body: signupBody("ada\u0000@example.com") });
      expect(res.status).toBe(400);
    }
  });

  it("login with an invalid body -> 400", async () => {
    expect((await api("POST", "/auth/login", { body: { email: "ada@example.com" } })).status).toBe(400);
    expect((await api("POST", "/auth/login", { body: {} })).status).toBe(400);
  });

  it("malformed JSON -> 400, not 500", async () => {
    const response = await createApp().request("/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });
    expect(response.status).toBe(400);
  });

  it("password_hash never appears in signup or login responses", async () => {
    const signup = await api("POST", "/auth/signup", { body: signupBody("ada@example.com") });
    const login = await api("POST", "/auth/login", { body: { email: "ada@example.com", password: TEST_PASSWORD } });
    for (const res of [signup, login]) {
      const text = JSON.stringify(res.body);
      expect(text).not.toMatch(/password|hash|\$2[aby]\$/i);
    }
  });
});

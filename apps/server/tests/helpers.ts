import { randomUUID } from "node:crypto";
import { describe } from "vitest";
import { createApp } from "../src/app.js";
import { getPool } from "../src/db/pool.js";
import { assertCurrentSchema, hasDatabase, testSchemaName } from "./schemaGuard.js";

export const TEST_PASSWORD = "password123";

/** `describe` that skips (with a visible reason) when there is no DATABASE_URL. */
export const describeDb = hasDatabase()
  ? describe
  : (name: string, fn: () => void) => describe.skip(`${name} [skipped: DATABASE_URL not set]`, fn);

type ApiOptions = { body?: unknown; userId?: string; headers?: Record<string, string> };
export type ApiResponse<T = any> = { status: number; body: T };

/** Calls the app in-process (no port). `body` is sent as JSON, `userId` as x-user-id. */
export async function api<T = any>(method: string, path: string, options: ApiOptions = {}): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = { ...options.headers };
  if (options.userId !== undefined) headers["x-user-id"] = options.userId;
  if (options.body !== undefined) headers["content-type"] = "application/json";

  const response = await createApp().request(path, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : undefined };
}

const TABLES = ["friends", "swipes", "events", "users"];

/** Empties every table in the per-run test schema. Refuses unless the pool is really on that schema. */
export async function resetDb(): Promise<void> {
  const schema = testSchemaName();
  const client = await getPool().connect();
  try {
    await assertCurrentSchema(client, schema);
    const qualified = TABLES.map((table) => `${schema}.${table}`).join(", ");
    await client.query(`TRUNCATE ${qualified} CASCADE`);
  } finally {
    client.release();
  }
}

export function uniqueEmail(name: string): string {
  return `${name.toLowerCase()}-${randomUUID().slice(0, 8)}@example.com`;
}

/** Signs a user up through the API and returns their id. */
export async function signup(name: string, email = uniqueEmail(name)): Promise<string> {
  const res = await api("POST", "/auth/signup", { body: { name, email, password: TEST_PASSWORD } });
  if (res.status !== 201) throw new Error(`signup(${name}) failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.user.id;
}

type UserFixture = { email?: string; contacts?: Record<string, string> };

/** Inserts a user row directly (no bcrypt, no auth route) and returns its id. */
export async function insertUser(name: string, fixture: UserFixture = {}): Promise<string> {
  const { rows } = await getPool().query<{ id: string }>(
    `INSERT INTO users (name, email, password_hash, contacts)
     VALUES ($1, $2, 'not-a-real-hash', $3) RETURNING id`,
    [name, fixture.email ?? uniqueEmail(name), JSON.stringify(fixture.contacts ?? {})],
  );
  return rows[0].id;
}

type EventFixture = { title?: string; tags?: string[]; startsAt: Date; priceMin?: number; priceMax?: number };

/** Inserts an event directly, so it can be in the past (the API refuses that). Returns its id. */
export async function insertEvent(fixture: EventFixture): Promise<string> {
  const { rows } = await getPool().query<{ id: string }>(
    `INSERT INTO events (title, tags, starts_at, price_min, price_max)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [
      fixture.title ?? "Test event",
      fixture.tags ?? ["music"],
      fixture.startsAt,
      fixture.priceMin ?? null,
      fixture.priceMax ?? null,
    ],
  );
  return rows[0].id;
}

export function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 3_600_000);
}

export async function swipe(userId: string, eventId: string, action: string): Promise<void> {
  const res = await api("POST", "/swipes", { userId, body: { eventId, action } });
  if (res.status !== 200) throw new Error(`swipe failed: ${res.status} ${JSON.stringify(res.body)}`);
}

/** Makes two users accepted friends through the API (request + accept). */
export async function makeFriends(a: string, b: string): Promise<void> {
  const requested = await api("POST", "/friends/requests", { userId: a, body: { userId: b } });
  const accepted = await api("POST", `/friends/requests/${a}/accept`, { userId: b });
  if (requested.status !== 201 || accepted.status !== 200) {
    throw new Error(`makeFriends failed: ${requested.status} / ${accepted.status}`);
  }
}

/** All friends rows, as "user->friend:status" strings, for asserting on stored state. */
export async function friendRows(): Promise<string[]> {
  const { rows } = await getPool().query<{ row: string }>(
    "SELECT user_id || '->' || friend_id || ':' || status AS row FROM friends ORDER BY 1",
  );
  return rows.map((r) => r.row);
}

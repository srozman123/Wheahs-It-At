import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { beforeEach, expect, it, vi } from "vitest";
import { getPool } from "../src/db/pool.js";
import {
  SEED_FRIENDSHIPS,
  SEED_PENDING_REQUESTS,
  SEED_SWIPES,
  SEED_USERS,
  buildSeedEvents,
} from "../src/scripts/seedData.js";
import { api, describeDb, hoursFromNow, insertEvent, insertUser, makeFriends, resetDb, swipe } from "./helpers.js";
import { testSchemaName } from "./schemaGuard.js";

const run = promisify(execFile);
const TSX = new URL("../node_modules/.bin/tsx", import.meta.url).pathname;
const SERVER_DIR = new URL("..", import.meta.url).pathname;
const SCRIPT_TIMEOUT_MS = 60_000;

/** Runs a seed script as a child process, pinned to the per-run test schema. */
async function runScript(name: "seed" | "clear-seed"): Promise<string> {
  const { stdout } = await run(TSX, [`src/scripts/${name}.ts`], {
    cwd: SERVER_DIR,
    env: { ...process.env, DB_SCHEMA: testSchemaName() },
  });
  return stdout;
}

async function count(sql: string): Promise<number> {
  const { rows } = await getPool().query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM (${sql}) t`);
  return rows[0].n;
}

const seedUsers = () => count("SELECT 1 FROM users WHERE email LIKE '%@seed.test'");
const seedEvents = () => count("SELECT 1 FROM events WHERE source_url LIKE 'seed://%'");

const { upcoming, expired } = buildSeedEvents(new Date());

async function expectFullSeed(): Promise<void> {
  expect(await seedUsers()).toBe(SEED_USERS.length);
  expect(await seedEvents()).toBe(upcoming.length + expired.length);
  expect(await count("SELECT 1 FROM events WHERE source_url LIKE 'seed://%' AND starts_at < now()")).toBe(expired.length);
  expect(await count("SELECT 1 FROM events WHERE creator_id IS NOT NULL AND source_url LIKE 'seed://%'")).toBe(0);
  expect(await count("SELECT 1 FROM friends")).toBe(2 * SEED_FRIENDSHIPS.length + SEED_PENDING_REQUESTS.length);
  expect(await count("SELECT 1 FROM swipes")).toBe(SEED_SWIPES.length);
}

// Each script run starts tsx and hashes a bcrypt password.
vi.setConfig({ testTimeout: SCRIPT_TIMEOUT_MS });

describeDb("seed scripts", () => {
  beforeEach(resetDb);

  it("seed data matches the spec: 6 users, 45 upcoming within 7 days, 3 expired", () => {
    expect(SEED_USERS).toHaveLength(6);
    expect(upcoming).toHaveLength(45);
    expect(expired).toHaveLength(3);
    const weekFromNow = hoursFromNow(168).getTime();
    for (const event of upcoming) {
      expect(event.startsAt.getTime()).toBeGreaterThan(Date.now());
      expect(event.startsAt.getTime()).toBeLessThan(weekFromNow);
    }
  });

  it("seed inserts the expected rows; re-running doesn't duplicate", async () => {
    const stdout = await runScript("seed");
    expect(stdout).toMatch(/Seeded 6 users, 45 upcoming and 3 expired events/);
    await expectFullSeed();

    await runScript("seed");
    await expectFullSeed();
  });

  it("seed users can log in with the documented password", async () => {
    await runScript("seed");
    const res = await api("POST", "/auth/login", { body: { email: SEED_USERS[0].email, password: "password123" } });
    expect(res.status).toBe(200);
  });

  it("clear-seed removes only seed rows, even after a seed user posted an event (A8)", async () => {
    const realUser = await insertUser("Real Person");
    const realEvent = await insertEvent({ title: "real event", startsAt: hoursFromNow(5) });
    await runScript("seed");

    const { rows } = await getPool().query<{ id: string }>("SELECT id FROM users WHERE email = $1", [SEED_USERS[0].email]);
    const seedUser = rows[0].id;
    const posted = await api("POST", "/events", {
      userId: seedUser,
      body: { title: "Seed user's event", tags: ["music"], startsAt: hoursFromNow(10).toISOString() },
    });
    expect(posted.status).toBe(201);

    // Real rows linked to seed rows (cascade-deleted on clear, as A8 notes).
    await swipe(realUser, (await getPool().query("SELECT id FROM events WHERE source_url = 'seed://event-1'")).rows[0].id, "save");
    await makeFriends(realUser, seedUser);
    await swipe(realUser, realEvent, "going");

    const stdout = await runScript("clear-seed");
    expect(stdout).toMatch(`Removed ${upcoming.length + expired.length + 1} seed events and ${SEED_USERS.length} seed users.`);

    expect(await seedUsers()).toBe(0);
    expect(await seedEvents()).toBe(0);
    expect(await count(`SELECT 1 FROM events WHERE id = '${posted.body.event.id}'`)).toBe(0);
    expect(await count(`SELECT 1 FROM users WHERE id = '${realUser}'`)).toBe(1);
    expect(await count(`SELECT 1 FROM events WHERE id = '${realEvent}'`)).toBe(1);
    expect(await count("SELECT 1 FROM friends")).toBe(0);
    expect(await count("SELECT 1 FROM swipes")).toBe(1); // only the real user's swipe on the real event
  });

  it("clear-seed on an empty database is a no-op", async () => {
    expect(await runScript("clear-seed")).toMatch("Removed 0 seed events and 0 seed users.");
  });
});

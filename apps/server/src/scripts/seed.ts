import "dotenv/config";
import bcrypt from "bcryptjs";
import type { PoolClient } from "pg";
import { getPool, withTransaction } from "../db/pool.js";
import { clearSeedData } from "./clearSeed.js";
import {
  SEED_FRIENDSHIPS,
  SEED_PASSWORD,
  SEED_PENDING_REQUESTS,
  SEED_SWIPES,
  SEED_USERS,
  buildSeedEvents,
  type SeedEvent,
} from "./seedData.js";

const BCRYPT_COST = 10;

async function insertUsers(client: PoolClient, passwordHash: string): Promise<string[]> {
  const ids: string[] = [];
  for (const user of SEED_USERS) {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO users (name, email, password_hash, contacts, interests)
       VALUES ($1, $2, $3, $4::jsonb, $5) RETURNING id`,
      [user.name, user.email, passwordHash, JSON.stringify(user.contacts), user.interests],
    );
    ids.push(rows[0].id);
  }
  return ids;
}

async function insertEvents(client: PoolClient, events: SeedEvent[]): Promise<string[]> {
  const ids: string[] = [];
  for (const event of events) {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO events
         (title, tags, starts_at, location, lat, lng, image_url, source_url, price_min, price_max)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [
        event.title, event.tags, event.startsAt, event.location, event.lat, event.lng,
        event.imageUrl, event.sourceUrl, event.priceMin, event.priceMax,
      ],
    );
    ids.push(rows[0].id);
  }
  return ids;
}

async function insertFriends(client: PoolClient, userIds: string[]): Promise<void> {
  const insert = (from: number, to: number, status: "accepted" | "requested") =>
    client.query("INSERT INTO friends (user_id, friend_id, status) VALUES ($1, $2, $3)", [
      userIds[from], userIds[to], status,
    ]);

  for (const [a, b] of SEED_FRIENDSHIPS) {
    await insert(a, b, "accepted");
    await insert(b, a, "accepted");
  }
  for (const [from, to] of SEED_PENDING_REQUESTS) {
    await insert(from, to, "requested");
  }
}

async function insertSwipes(
  client: PoolClient,
  userIds: string[],
  upcomingIds: string[],
  expiredIds: string[],
): Promise<void> {
  for (const swipe of SEED_SWIPES) {
    const eventId = (swipe.expired ? expiredIds : upcomingIds)[swipe.event];
    await client.query("INSERT INTO swipes (user_id, event_id, action) VALUES ($1, $2, $3)", [
      userIds[swipe.user], eventId, swipe.action,
    ]);
  }
}

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, BCRYPT_COST);
  const { upcoming, expired } = buildSeedEvents(new Date());

  try {
    await withTransaction(async (client) => {
      await clearSeedData(client);
      const userIds = await insertUsers(client, passwordHash);
      const upcomingIds = await insertEvents(client, upcoming);
      const expiredIds = await insertEvents(client, expired);
      await insertFriends(client, userIds);
      await insertSwipes(client, userIds, upcomingIds, expiredIds);
    });
    console.log(
      `Seeded ${SEED_USERS.length} users, ${upcoming.length} upcoming and ${expired.length} expired events, ` +
        `${SEED_FRIENDSHIPS.length} friendships, ${SEED_PENDING_REQUESTS.length} pending request, ${SEED_SWIPES.length} swipes.`,
    );
  } finally {
    await getPool().end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

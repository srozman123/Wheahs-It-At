import type { Queryable } from "../db/queryable.js";

export type ClearCounts = { events: number; users: number };

// Order matters: events.creator_id has no cascade, so events made by seed users go before the users.
// Real users' swipes and friendships with seed rows are cascade-deleted too.
export async function clearSeedData(db: Queryable): Promise<ClearCounts> {
  const byCreator = await db.query(
    "DELETE FROM events WHERE creator_id IN (SELECT id FROM users WHERE email LIKE '%@seed.test')",
  );
  const bySource = await db.query("DELETE FROM events WHERE source_url LIKE 'seed://%'");
  const users = await db.query("DELETE FROM users WHERE email LIKE '%@seed.test'");
  return { events: (byCreator.rowCount ?? 0) + (bySource.rowCount ?? 0), users: users.rowCount ?? 0 };
}

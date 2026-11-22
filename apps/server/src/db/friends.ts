import { getPool, withTransaction } from "./pool.js";
import type { UserSummary } from "./users.js";

export type FriendStatus = "requested" | "accepted";

// What each side has recorded about the other; undefined means no row.
export type Relationship = { outgoing?: FriendStatus; incoming?: FriendStatus };

// "My friends" is always the accepted rows where I am user_id.
export async function listAcceptedFriendIds(userId: string): Promise<string[]> {
  const { rows } = await getPool().query<{ id: string }>(
    "SELECT friend_id AS id FROM friends WHERE user_id = $1 AND status = 'accepted'",
    [userId],
  );
  return rows.map((row) => row.id);
}

export async function listAcceptedFriends(userId: string): Promise<UserSummary[]> {
  const { rows } = await getPool().query<UserSummary>(
    `SELECT u.id, u.name, u.contacts
       FROM friends f JOIN users u ON u.id = f.friend_id
      WHERE f.user_id = $1 AND f.status = 'accepted'
      ORDER BY u.name`,
    [userId],
  );
  return rows;
}

export async function listIncomingRequesters(userId: string): Promise<UserSummary[]> {
  const { rows } = await getPool().query<UserSummary>(
    `SELECT u.id, u.name, u.contacts
       FROM friends f JOIN users u ON u.id = f.user_id
      WHERE f.friend_id = $1 AND f.status = 'requested'
      ORDER BY f.created_at DESC`,
    [userId],
  );
  return rows;
}

export async function listOutgoingRequestees(userId: string): Promise<UserSummary[]> {
  const { rows } = await getPool().query<UserSummary>(
    `SELECT u.id, u.name, u.contacts
       FROM friends f JOIN users u ON u.id = f.friend_id
      WHERE f.user_id = $1 AND f.status = 'requested'
      ORDER BY f.created_at DESC`,
    [userId],
  );
  return rows;
}

export async function findRelationship(me: string, them: string): Promise<Relationship> {
  const { rows } = await getPool().query<{ userId: string; status: FriendStatus }>(
    `SELECT user_id AS "userId", status
       FROM friends
      WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`,
    [me, them],
  );
  const relationship: Relationship = {};
  for (const row of rows) {
    relationship[row.userId === me ? "outgoing" : "incoming"] = row.status;
  }
  return relationship;
}

export async function insertRequest(me: string, them: string): Promise<void> {
  await getPool().query(
    "INSERT INTO friends (user_id, friend_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    [me, them],
  );
}

// Accepts their pending request to me and records the mirrored row, atomically.
// Returns false when there is no pending request from them.
export function acceptRequest(me: string, them: string): Promise<boolean> {
  return withTransaction(async (client) => {
    const accepted = await client.query(
      `UPDATE friends SET status = 'accepted'
        WHERE user_id = $1 AND friend_id = $2 AND status = 'requested'`,
      [them, me],
    );
    if (accepted.rowCount === 0) {
      return false;
    }
    await client.query(
      `INSERT INTO friends (user_id, friend_id, status) VALUES ($1, $2, 'accepted')
       ON CONFLICT (user_id, friend_id) DO UPDATE SET status = 'accepted'`,
      [me, them],
    );
    return true;
  });
}

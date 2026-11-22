import type { Queryable } from "./queryable.js";

export const SWIPE_ACTIONS = ["pass", "save", "going", "removed"] as const;

export type SwipeAction = (typeof SWIPE_ACTIONS)[number];

export type Swipe = { eventId: string; action: SwipeAction };

// Returns undefined when the event doesn't exist (nothing is inserted).
export async function upsertSwipe(
  db: Queryable,
  userId: string,
  eventId: string,
  action: SwipeAction,
): Promise<Swipe | undefined> {
  const { rows } = await db.query<Swipe>(
    `INSERT INTO swipes (user_id, event_id, action)
     SELECT $1, id, $3::swipe_action FROM events WHERE id = $2
     ON CONFLICT (user_id, event_id) DO UPDATE SET action = EXCLUDED.action, updated_at = now()
     RETURNING event_id AS "eventId", action`,
    [userId, eventId, action],
  );
  return rows[0];
}

export type SwipedTags = { action: SwipeAction; tags: string[] };

// Includes expired events: past behaviour still says what the user likes.
export async function listSwipedTags(db: Queryable, userId: string): Promise<SwipedTags[]> {
  const { rows } = await db.query<SwipedTags>(
    "SELECT s.action, e.tags FROM swipes s JOIN events e ON e.id = s.event_id WHERE s.user_id = $1",
    [userId],
  );
  return rows;
}

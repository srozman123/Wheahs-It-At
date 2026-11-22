import { getPool, withTransaction } from "./pool.js";
import type { Queryable } from "./queryable.js";
import { upsertSwipe, type SwipeAction } from "./swipes.js";
import type { UserSummary } from "./users.js";

export type Card = {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  startsAt: string;
  location: string | null;
  lat: number | null;
  lng: number | null;
  imageUrl: string | null;
  sourceUrl: string | null;
  priceMin: number | null;
  priceMax: number | null;
  creatorId: string | null;
  friendsGoing: number;
  expired: boolean;
};

export type NewEvent = {
  title: string;
  description?: string;
  tags: string[];
  startsAt: string;
  location?: string;
  lat?: number;
  lng?: number;
  imageUrl?: string;
  sourceUrl?: string;
  priceMin?: number;
  priceMax?: number;
};

// The ONE Card select. $1 is always the viewer; callers append joins/WHERE/ORDER BY and
// further params ($2...) after it.
const CARD_SELECT = `
  SELECT e.id, e.title, e.description, e.tags,
         to_json(e.starts_at) #>> '{}' AS "startsAt",
         e.location, e.lat, e.lng,
         e.image_url AS "imageUrl", e.source_url AS "sourceUrl",
         e.price_min::float8 AS "priceMin", e.price_max::float8 AS "priceMax",
         e.creator_id AS "creatorId",
         (SELECT COUNT(*)::int
            FROM friends f
            JOIN swipes fs ON fs.user_id = f.friend_id AND fs.event_id = e.id AND fs.action = 'going'
           WHERE f.user_id = $1 AND f.status = 'accepted') AS "friendsGoing",
         (e.starts_at < now()) AS expired
    FROM events e`;

async function queryCards(
  db: Queryable,
  viewerId: string,
  sqlTail: string,
  params: unknown[] = [],
): Promise<Card[]> {
  const { rows } = await db.query<Card>(`${CARD_SELECT} ${sqlTail}`, [viewerId, ...params]);
  return rows;
}

export async function getCardById(
  viewerId: string,
  eventId: string,
  db: Queryable = getPool(),
): Promise<Card | undefined> {
  const cards = await queryCards(db, viewerId, "WHERE e.id = $2", [eventId]);
  return cards[0];
}

export function listCardsBySwipeAction(viewerId: string, action: SwipeAction): Promise<Card[]> {
  return queryCards(
    getPool(),
    viewerId,
    `JOIN swipes s ON s.event_id = e.id AND s.user_id = $1 AND s.action = $2::swipe_action
     ORDER BY e.starts_at ASC`,
    [action],
  );
}

// The creator automatically counts as going.
export function createEvent(creatorId: string, event: NewEvent): Promise<Card> {
  return withTransaction(async (client) => {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO events
         (title, description, tags, starts_at, location, lat, lng, image_url, source_url,
          price_min, price_max, creator_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id`,
      [
        event.title,
        event.description ?? null,
        event.tags,
        event.startsAt,
        event.location ?? null,
        event.lat ?? null,
        event.lng ?? null,
        event.imageUrl ?? null,
        event.sourceUrl ?? null,
        event.priceMin ?? null,
        event.priceMax ?? null,
        creatorId,
      ],
    );
    const eventId = rows[0].id;
    await upsertSwipe(client, creatorId, eventId, "going");
    return (await getCardById(creatorId, eventId, client))!;
  });
}

// Excludes the viewer; ordered by name.
export async function listGoingUsers(eventId: string, viewerId: string): Promise<UserSummary[]> {
  const { rows } = await getPool().query<UserSummary>(
    `SELECT u.id, u.name, u.contacts
       FROM swipes s JOIN users u ON u.id = s.user_id
      WHERE s.event_id = $1 AND s.action = 'going' AND u.id <> $2
      ORDER BY u.name`,
    [eventId, viewerId],
  );
  return rows;
}

export type FriendsGoingEvent = Card & { goingFriends: { id: string; name: string }[] };

// Only 'going' swipes are read here: a friend's 'save' is never exposed.
export async function listFriendsGoingEvents(viewerId: string): Promise<FriendsGoingEvent[]> {
  const db = getPool();
  const { rows } = await db.query<{ eventId: string; id: string; name: string }>(
    `SELECT s.event_id AS "eventId", u.id, u.name
       FROM friends f
       JOIN swipes s ON s.user_id = f.friend_id AND s.action = 'going'
       JOIN events e ON e.id = s.event_id AND e.starts_at >= now()
       JOIN users u ON u.id = f.friend_id
      WHERE f.user_id = $1 AND f.status = 'accepted'
      ORDER BY u.name`,
    [viewerId],
  );

  const friendsByEvent = new Map<string, { id: string; name: string }[]>();
  for (const { eventId, id, name } of rows) {
    friendsByEvent.set(eventId, [...(friendsByEvent.get(eventId) ?? []), { id, name }]);
  }
  if (friendsByEvent.size === 0) {
    return [];
  }

  const cards = await queryCards(db, viewerId, "WHERE e.id = ANY($2::uuid[]) ORDER BY e.starts_at ASC", [
    [...friendsByEvent.keys()],
  ]);
  return cards.map((card) => ({ ...card, goingFriends: friendsByEvent.get(card.id) ?? [] }));
}

// Upcoming within a rolling 7 days, not yet swiped by the viewer, minus the ids the client already holds.
export function listFeedCandidates(viewerId: string, excludeIds: string[]): Promise<Card[]> {
  return queryCards(
    getPool(),
    viewerId,
    `WHERE e.starts_at >= now()
       AND e.starts_at < now() + interval '7 days'
       AND NOT EXISTS (SELECT 1 FROM swipes s WHERE s.event_id = e.id AND s.user_id = $1)
       AND NOT (e.id = ANY($2::uuid[]))`,
    [excludeIds],
  );
}

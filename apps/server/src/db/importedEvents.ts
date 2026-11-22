import type { TaggedEvent } from "../import/types.js";
import type { Queryable } from "./queryable.js";

// The only SQL the importer uses. Callers wrap insertImportedEvents in withTransaction.

const IMPORT_LOCK_ID = 7_302_024_001n;
const CHUNK_SIZE = 200;
const COLUMNS = [
  "title", "description", "tags", "starts_at", "location", "lat", "lng", "image_url", "source_url", "price_min", "price_max",
] as const;

const keyOf = (sourceUrl: string, startsAt: string | Date) => `${sourceUrl}|${new Date(startsAt).getTime()}`;

async function existingKeys(db: Queryable, urls: string[]): Promise<Set<string>> {
  if (urls.length === 0) return new Set();
  const { rows } = await db.query<{ source_url: string; starts_at: Date }>(
    "SELECT source_url, starts_at FROM events WHERE source_url = ANY($1::text[])",
    [urls],
  );
  return new Set(rows.map((r) => keyOf(r.source_url, r.starts_at)));
}

function toRow(e: TaggedEvent): unknown[] {
  return [
    e.title, e.description, e.tags, e.startsAt, e.location ?? e.address, e.lat, e.lng, e.imageUrl, e.sourceUrl, e.priceMin, e.priceMax,
  ];
}

async function insertChunk(db: Queryable, chunk: TaggedEvent[]): Promise<void> {
  const width = COLUMNS.length;
  const placeholders = chunk.map(
    (_, row) => `(${COLUMNS.map((_c, col) => `$${row * width + col + 1}`).join(", ")}, NULL)`,
  );
  await db.query(
    `INSERT INTO events (${COLUMNS.join(", ")}, creator_id) VALUES ${placeholders.join(", ")}`,
    chunk.flatMap(toRow),
  );
}

export async function insertImportedEvents(
  db: Queryable,
  events: TaggedEvent[],
): Promise<{ inserted: number; skipped: number }> {
  await db.query("SELECT pg_advisory_xact_lock($1::bigint)", [IMPORT_LOCK_ID.toString()]);

  const existing = await existingKeys(db, [...new Set(events.map((e) => e.sourceUrl))]);
  const fresh: TaggedEvent[] = [];
  for (const event of events) {
    const key = keyOf(event.sourceUrl, event.startsAt);
    if (existing.has(key)) continue;
    existing.add(key); // also catches duplicates inside this batch
    fresh.push(event);
  }

  for (let i = 0; i < fresh.length; i += CHUNK_SIZE) await insertChunk(db, fresh.slice(i, i + CHUNK_SIZE));
  return { inserted: fresh.length, skipped: events.length - fresh.length };
}

/** Removes previously imported events; keeps user posts (creator_id set) and seed:// demo events. */
export async function clearImportedEvents(db: Queryable): Promise<number> {
  const result = await db.query(
    "DELETE FROM events WHERE creator_id IS NULL AND (source_url IS NULL OR source_url NOT LIKE 'seed://%')",
  );
  return result.rowCount ?? 0;
}

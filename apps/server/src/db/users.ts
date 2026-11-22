import { getPool } from "./pool.js";

export type Contacts = {
  instagram?: string;
  snapchat?: string;
  phone?: string;
  email?: string;
};

export type UserSummary = { id: string; name: string; contacts: Contacts };

export type Me = {
  id: string;
  name: string;
  email: string;
  contacts: Contacts;
  interests: string[];
  createdAt: string;
};

export type MeUpdate = {
  name?: string;
  contacts?: Contacts;
  interests?: string[];
};

type UserWithHash = Me & { passwordHash: string };

const ME_COLUMNS = `id, name, email, contacts, interests, to_json(created_at) #>> '{}' AS "createdAt"`;

export async function userExists(id: string): Promise<boolean> {
  const { rowCount } = await getPool().query("SELECT 1 FROM users WHERE id = $1", [id]);
  return rowCount === 1;
}

export async function createUser(name: string, email: string, passwordHash: string): Promise<Me> {
  const { rows } = await getPool().query<Me>(
    `INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING ${ME_COLUMNS}`,
    [name, email, passwordHash],
  );
  return rows[0];
}

export async function findUserByEmail(email: string): Promise<UserWithHash | undefined> {
  const { rows } = await getPool().query<UserWithHash>(
    `SELECT ${ME_COLUMNS}, password_hash AS "passwordHash" FROM users WHERE email = $1`,
    [email],
  );
  return rows[0];
}

export async function findMeById(id: string): Promise<Me | undefined> {
  const { rows } = await getPool().query<Me>(`SELECT ${ME_COLUMNS} FROM users WHERE id = $1`, [id]);
  return rows[0];
}

// Omitted fields keep their current value.
export async function updateMe(id: string, update: MeUpdate): Promise<Me> {
  const { rows } = await getPool().query<Me>(
    `UPDATE users
        SET name = COALESCE($2, name),
            contacts = COALESCE($3::jsonb, contacts),
            interests = COALESCE($4::text[], interests)
      WHERE id = $1
      RETURNING ${ME_COLUMNS}`,
    [
      id,
      update.name ?? null,
      update.contacts === undefined ? null : JSON.stringify(update.contacts),
      update.interests ?? null,
    ],
  );
  return rows[0];
}

export async function findUserSummaryById(id: string): Promise<UserSummary | undefined> {
  const { rows } = await getPool().query<UserSummary>(
    "SELECT id, name, contacts FROM users WHERE id = $1",
    [id],
  );
  return rows[0];
}

const SEARCH_LIMIT = 20;

// Name matches anywhere; email only matches exactly, so emails can't be enumerated by substring.
export async function searchUsers(viewerId: string, query: string): Promise<UserSummary[]> {
  const escaped = query.replace(/[\\%_]/g, "\\$&");
  const { rows } = await getPool().query<UserSummary>(
    `SELECT id, name, contacts
       FROM users
      WHERE id <> $1 AND (name ILIKE $2 OR lower(email) = lower(trim($3)))
      ORDER BY name
      LIMIT ${SEARCH_LIMIT}`,
    [viewerId, `%${escaped}%`, query],
  );
  return rows;
}

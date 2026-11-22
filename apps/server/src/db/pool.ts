import pg from "pg";

const SCHEMA_NAME = /^[a-z_][a-z0-9_]*$/;

let pool: pg.Pool | undefined;

function createPool(): pg.Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
  }

  const schema = process.env.DB_SCHEMA;
  if (schema !== undefined && !SCHEMA_NAME.test(schema)) {
    throw new Error("DB_SCHEMA must match /^[a-z_][a-z0-9_]*$/.");
  }

  // Use a direct (non-pooler) connection: poolers may ignore this startup option.
  // Tests guard against that by checking current_schema() before any destructive SQL.
  return new pg.Pool({
    connectionString,
    ...(schema ? { options: `-c search_path=${schema}` } : {}),
  });
}

// Created lazily so the app can start (e.g. for /health) before the database is configured.
export function getPool(): pg.Pool {
  pool ??= createPool();
  return pool;
}

export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

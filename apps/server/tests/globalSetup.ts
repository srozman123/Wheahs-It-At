import { readFile } from "node:fs/promises";
import pg from "pg";
import { assertCurrentSchema, hasDatabase, testSchemaName } from "./schemaGuard.js";

const SCHEMA_SQL = new URL("../src/db/schema.sql", import.meta.url);

async function withClient(fn: (client: pg.Client) => Promise<void>): Promise<void> {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await fn(client);
  } finally {
    await client.end();
  }
}

async function createTestSchema(schema: string): Promise<void> {
  await withClient(async (client) => {
    // A leftover schema can only exist if a crashed run had the same pid; the prefix check guards the drop.
    await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET search_path TO ${schema}`);
    // schema.sql starts with DROP TABLE, so it must only ever run inside the test schema.
    await assertCurrentSchema(client, schema);
    await client.query(await readFile(SCHEMA_SQL, "utf8"));
  });
}

async function dropTestSchema(schema: string): Promise<void> {
  await withClient(async (client) => {
    await client.query(`SET search_path TO ${schema}`);
    await assertCurrentSchema(client, schema);
    await client.query(`DROP SCHEMA ${schema} CASCADE`);
  });
}

export default async function setup(): Promise<(() => Promise<void>) | void> {
  const schema = testSchemaName();
  if (!hasDatabase()) {
    console.warn("\n[tests] DATABASE_URL is not set (apps/server/.env): DB-backed tests will be SKIPPED.\n");
    return;
  }
  await createTestSchema(schema);
  return () => dropTestSchema(schema);
}

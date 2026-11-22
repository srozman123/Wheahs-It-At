import type pg from "pg";

export const TEST_SCHEMA_PREFIX = "wia_test_";
const SCHEMA_NAME = /^[a-z_][a-z0-9_]*$/;

/** The per-run test schema. Throws unless it is a valid `wia_test_*` name (A2). */
export function testSchemaName(): string {
  const schema = process.env.DB_SCHEMA;
  if (!schema || !schema.startsWith(TEST_SCHEMA_PREFIX) || !SCHEMA_NAME.test(schema)) {
    throw new Error(`Refusing to touch the database: DB_SCHEMA must be a ${TEST_SCHEMA_PREFIX}* name.`);
  }
  return schema;
}

/** Throws unless this connection's current_schema() is exactly `schema` (A1). Call before any DROP/TRUNCATE. */
export async function assertCurrentSchema(client: pg.ClientBase, schema: string): Promise<void> {
  const { rows } = await client.query<{ current_schema: string | null }>("SELECT current_schema()");
  const actual = rows[0]?.current_schema;
  if (actual !== schema) {
    throw new Error(`Refusing to modify the database: current_schema() is ${actual}, expected ${schema}.`);
  }
}

export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

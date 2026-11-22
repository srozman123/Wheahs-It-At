import "dotenv/config";
import { readFile } from "node:fs/promises";
import { getPool } from "../db/pool.js";

const SCHEMA_PATH = new URL("../db/schema.sql", import.meta.url);

async function main(): Promise<void> {
  if (!process.argv.includes("--yes")) {
    console.error("WARNING: db:setup DROPS and recreates all tables, deleting all data.");
    console.error("Re-run with --yes to confirm: npm run db:setup -- --yes");
    process.exit(1);
  }

  const pool = getPool();
  try {
    await pool.query(await readFile(SCHEMA_PATH, "utf8"));
    console.log("Schema created.");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

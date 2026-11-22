import { afterAll } from "vitest";
import { getPool } from "../src/db/pool.js";
import { hasDatabase } from "./schemaGuard.js";

// Each test file runs in its own module graph, so each gets (and must close) its own pool.
afterAll(async () => {
  if (hasDatabase()) await getPool().end();
});

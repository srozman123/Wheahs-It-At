import { config as loadEnv } from "dotenv";
import { defineConfig } from "vitest/config";

loadEnv({ path: new URL("./.env", import.meta.url), quiet: true });

// One schema per run (amendment A2). The name is generated here, in the main process,
// and handed to globalSetup (same process) and to every worker through `test.env`.
const testSchema = `wia_test_${process.pid}`;
process.env.DB_SCHEMA = testSchema;

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/globalSetup.ts"],
    setupFiles: ["tests/setup.ts"],
    env: { DB_SCHEMA: testSchema },
    // All files share one schema, so they must not run concurrently.
    fileParallelism: false,
  },
});

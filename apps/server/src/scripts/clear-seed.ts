import "dotenv/config";
import { getPool, withTransaction } from "../db/pool.js";
import { clearSeedData } from "./clearSeed.js";

async function main(): Promise<void> {
  try {
    const counts = await withTransaction(clearSeedData);
    console.log(`Removed ${counts.events} seed events and ${counts.users} seed users.`);
  } finally {
    await getPool().end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

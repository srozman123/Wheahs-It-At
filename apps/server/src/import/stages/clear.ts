import { withTransaction } from "../../db/pool.js";
import { clearImportedEvents } from "../../db/importedEvents.js";
import type { Logger } from "../types.js";

export async function runClear(opts: { yes: boolean; log?: Logger }): Promise<number> {
  const log = opts.log ?? console.log;
  if (!opts.yes) {
    log("WARNING: this deletes ALL imported events (creator_id NULL and not seed://) and their swipes.");
    log("Re-run with --yes to confirm: npm run import:clear -- --yes");
    return 0;
  }
  const deleted = await withTransaction((client) => clearImportedEvents(client));
  log(`Deleted ${deleted} imported events`);
  return deleted;
}

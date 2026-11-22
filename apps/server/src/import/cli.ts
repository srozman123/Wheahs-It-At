import "dotenv/config";
import { getPool } from "../db/pool.js";

const STAGES = ["fetch", "normalize", "save", "clear", "all"] as const;
type Stage = (typeof STAGES)[number];

async function main(): Promise<void> {
  const stage = process.argv[2] as Stage | undefined;
  if (!stage || !STAGES.includes(stage)) {
    console.error(`Usage: tsx src/import/cli.ts <${STAGES.join("|")}> [--dry-run] [--yes]`);
    process.exit(1);
  }
  const flags = new Set(process.argv.slice(3));
  let usedDb = false;
  try {
    // Loaded lazily so a typo'd stage fails fast without importing every module.
    if (stage === "fetch" || stage === "all") await (await import("./stages/fetch.js")).runFetch();
    if (stage === "normalize" || stage === "all") {
      try {
        await (await import("./stages/normalize.js")).runNormalize();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`${message}\nTagging needs ANTHROPIC_API_KEY in apps/server/.env, or tag with Claude Code instead (see src/import/README.md).`);
      }
    }
    if (stage === "save" || stage === "all") {
      usedDb = !flags.has("--dry-run");
      await (await import("./stages/save.js")).runSave({ dryRun: flags.has("--dry-run") });
    }
    if (stage === "clear") {
      usedDb = flags.has("--yes");
      await (await import("./stages/clear.js")).runClear({ yes: flags.has("--yes") });
    }
  } finally {
    if (usedDb) await getPool().end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

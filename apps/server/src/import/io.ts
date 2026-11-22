import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { z } from "zod";
import { TagAnnotationSchema } from "./types.js";
import type { Logger, TagAnnotation } from "./types.js";

/** Reads a JSON array file and validates every element. Throws with the first bad index. */
export async function readJsonArray<S extends z.ZodType>(path: string, schema: S): Promise<z.infer<S>[]> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    const reason = (error as NodeJS.ErrnoException).code === "ENOENT" ? "file not found" : (error as Error).message;
    throw new Error(`Can't read ${path}: ${reason}`);
  }
  if (!Array.isArray(parsed)) throw new Error(`${path} must contain a JSON array`);
  return parsed.map((item, index) => {
    const result = schema.safeParse(item);
    if (!result.success) {
      throw new Error(`${path} item ${index} is invalid: ${result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
    }
    return result.data;
  });
}

/** Like readJsonArray, but skips invalid items and reports them instead of throwing. */
export async function readJsonArrayLenient<S extends z.ZodType>(
  path: string,
  schema: S,
): Promise<{ items: z.infer<S>[]; invalid: { index: number; error: string }[] }> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    const reason = (error as NodeJS.ErrnoException).code === "ENOENT" ? "file not found" : (error as Error).message;
    throw new Error(`Can't read ${path}: ${reason}`);
  }
  if (!Array.isArray(parsed)) throw new Error(`${path} must contain a JSON array`);
  const items: z.infer<S>[] = [];
  const invalid: { index: number; error: string }[] = [];
  parsed.forEach((item, index) => {
    const result = schema.safeParse(item);
    if (result.success) items.push(result.data);
    else invalid.push({ index, error: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") });
  });
  return { items, invalid };
}

/** Like readJsonArray, but returns [] when the file doesn't exist yet. */
export async function readJsonArrayIfExists<S extends z.ZodType>(path: string, schema: S): Promise<z.infer<S>[]> {
  try {
    await readFile(path);
  } catch {
    return [];
  }
  return readJsonArray(path, schema);
}

/** Writes JSON atomically (temp file + rename), so a crash never leaves a half-written file. */
export async function writeJson(path: string, data: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.tmp`;
  await writeFile(temp, JSON.stringify(data, null, 1) + "\n", "utf8");
  await rename(temp, path);
}

/**
 * Reads the tags file, skipping and logging invalid entries (the raw file stays strict).
 * A missing file is an empty list unless `required`.
 */
export async function readTagsLenient(path: string, log: Logger, required = false): Promise<TagAnnotation[]> {
  if (!required) {
    try {
      await readFile(path);
    } catch {
      return [];
    }
  }
  const { items, invalid } = await readJsonArrayLenient(path, TagAnnotationSchema);
  if (invalid.length > 0) {
    log(`${invalid.length} invalid entries in events_tags.json skipped`);
    for (const bad of invalid.slice(0, 3)) log(`  entry ${bad.index}: ${bad.error}`);
  }
  return items;
}

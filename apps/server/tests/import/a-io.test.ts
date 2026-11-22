import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readJsonArrayLenient } from "../../src/import/io.js";

const dir = join(fileURLToPath(new URL("../..", import.meta.url)), `data/test-tmp-io-${process.pid}`);
beforeAll(() => mkdir(dir, { recursive: true }));
afterAll(() => rm(dir, { recursive: true, force: true }));

const schema = z.object({ n: z.number() });

describe("readJsonArrayLenient", () => {
  it("returns valid items and reports invalid ones by index", async () => {
    const path = join(dir, "a.json");
    await writeFile(path, JSON.stringify([{ n: 1 }, { n: "x" }, { n: 3 }]));
    const res = await readJsonArrayLenient(path, schema);
    expect(res.items).toEqual([{ n: 1 }, { n: 3 }]);
    expect(res.invalid).toHaveLength(1);
    expect(res.invalid[0].index).toBe(1);
    expect(res.invalid[0].error).toMatch(/n:/);
  });
  it("throws clearly for a missing file or a non-array", async () => {
    await expect(readJsonArrayLenient(join(dir, "missing.json"), schema)).rejects.toThrow(/file not found/);
    const path = join(dir, "obj.json");
    await writeFile(path, "{}");
    await expect(readJsonArrayLenient(path, schema)).rejects.toThrow(/JSON array/);
  });
});

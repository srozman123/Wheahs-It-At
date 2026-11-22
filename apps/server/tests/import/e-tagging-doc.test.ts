import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TAGS } from "../../src/tags.js";

describe("TAGGING.md", () => {
  const doc = readFileSync(new URL("../../src/import/TAGGING.md", import.meta.url), "utf8");
  const lines = doc.split("\n");
  const start = lines.findIndex((l) => /chosen ONLY from this list/i.test(l));
  // The comma-separated list is the indented block of lines after the marker, up to the next blank line after it.
  const listLines: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() === "") {
      if (listLines.length) break;
      continue;
    }
    listLines.push(line.trim());
  }
  const listed = listLines.join(" ").split(",").map((t) => t.trim()).filter(Boolean);

  it("has a tag list", () => expect(listed.length).toBeGreaterThan(0));
  it("lists every tag from src/tags.ts", () => {
    for (const tag of TAGS) expect(listed, `missing ${tag}`).toContain(tag);
  });
  it("lists no tag outside src/tags.ts", () => {
    const allowed = new Set<string>(TAGS);
    expect(listed.filter((t) => !allowed.has(t))).toEqual([]);
  });
});

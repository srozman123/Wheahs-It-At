import { zValidator } from "@hono/zod-validator";
import type { ValidationTargets } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { TAGS } from "./tags.js";

// Postgres text can't hold NUL, which would otherwise surface as a 500.
export const withoutNul = [
  (value: string) => !value.includes("\u0000"),
  "must not contain null characters",
] as const;

export const safeString = z.string().refine(...withoutNul);

const tagList = z.array(z.enum(TAGS));
const dedupe = (tags: string[]) => [...new Set(tags)];
export const interestsSchema = tagList.transform(dedupe);
export const eventTagsSchema = tagList.min(1).transform(dedupe);

// Trimmed and lowercased before validation, so signup and login compare the same value.
export const emailSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
  z.email(),
);

function describeIssues(error: { issues: z.core.$ZodIssue[] }): string {
  return error.issues
    .map((issue) => (issue.path.length ? `${issue.path.join(".")}: ${issue.message}` : issue.message))
    .join("; ");
}

// Shared by every route: invalid input becomes a 400 `{ error }` through app.onError.
export function validate<Target extends keyof ValidationTargets, Schema extends z.ZodType>(
  target: Target,
  schema: Schema,
) {
  return zValidator(target, schema, (result) => {
    if (!result.success) {
      throw new HTTPException(400, { message: describeIssues(result.error) });
    }
  });
}

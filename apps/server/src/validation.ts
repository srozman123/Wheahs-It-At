import { zValidator } from "@hono/zod-validator";
import type { ValidationTargets } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

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

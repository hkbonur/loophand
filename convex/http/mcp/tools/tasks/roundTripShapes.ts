import { z } from "zod";

// Shared response shapes for the round-trip context get_task and await_task both
// surface on consume — one source of truth so the two tools never drift.
export const commentShape = z.object({
  author: z.enum(["human", "agent"]),
  body: z.string(),
  created_at: z.number(),
});

export const preferencesShape = z.record(z.string(), z.string());

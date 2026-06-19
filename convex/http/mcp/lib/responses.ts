import { z } from "zod";

// Canonical envelope every MCP tool returns. The discriminated `success` flag
// lets agents (and tests) branch without shape-sniffing.
export type McpValidationDetail = { path: string; message: string; received?: string };
export type McpSuccess<TPayload> = { success: true } & TPayload;
export type McpFailure = {
  success: false;
  error: string;
  details?: McpValidationDetail[];
  suggestion?: string;
  recoverable?: boolean;
};
export type McpResponse<TPayload = Record<string, unknown>> = McpSuccess<TPayload> | McpFailure;

export type McpErrorHints = { suggestion?: string; recoverable?: boolean };

export function mcpSuccess<T extends Record<string, unknown>>(data: T): McpSuccess<T> {
  return { success: true as const, ...data };
}

export function mcpError(
  error: string,
  detail?: string,
  details?: McpValidationDetail[],
  hints?: McpErrorHints,
): McpFailure {
  return {
    success: false as const,
    error: detail ? `${error}: ${detail}` : error,
    ...(details && details.length > 0 ? { details } : {}),
    ...(hints?.suggestion ? { suggestion: hints.suggestion } : {}),
    ...(hints?.recoverable !== undefined ? { recoverable: hints.recoverable } : {}),
  };
}

// Convex `_creationTime` is a fractional-ms float; MCP callers expect integer
// epoch ms — truncate at the response boundary.
export function toEpochMs(value: number): number {
  return Math.trunc(value);
}

export const mcpFailureShape = z.object({
  success: z.literal(false),
  error: z.string(),
  details: z
    .array(z.object({ path: z.string(), message: z.string(), received: z.string().optional() }))
    .optional(),
  suggestion: z.string().optional(),
  recoverable: z.boolean().optional(),
});

export function mcpEnvelope<TSuccess extends z.ZodRawShape>(successFields: TSuccess) {
  const success = z.object({ success: z.literal(true), ...successFields });
  return z.discriminatedUnion("success", [success, mcpFailureShape]);
}

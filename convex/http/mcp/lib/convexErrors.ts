function errorName(error: unknown): string | undefined {
  if (
    error &&
    typeof error === "object" &&
    "name" in error &&
    typeof (error as { name?: unknown }).name === "string"
  ) {
    return (error as { name: string }).name;
  }
  return undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// Convex throws ArgumentValidationError when a `v.id(...)` arg fails validation.
export function isArgumentValidationError(error: unknown): boolean {
  const name = errorName(error);
  if (name === "ArgumentValidationError" || name === "ConvexValidationError") return true;
  const message = errorMessage(error);
  return (
    message.includes("ArgumentValidationError") ||
    message.includes("Value does not match validator")
  );
}

export function isCursorParseError(error: unknown): boolean {
  return errorMessage(error).includes("Failed to parse cursor");
}

// ConvexError carries `{ code, message }` on `error.data`. Structural check so
// we don't depend on the ConvexError class being present in this bundle.
function errorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("data" in error)) return undefined;
  const data = (error as { data?: unknown }).data;
  if (!data || typeof data !== "object" || !("code" in data)) return undefined;
  const code = (data as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

export { errorCode, errorMessage };

// Tiny structured logger. Convex captures console output per-function; this
// keeps a stable event-name + meta shape so logs are greppable.
type Meta = Record<string, unknown>;

function emit(level: "info" | "warn" | "error" | "audit", event: string, meta?: Meta): void {
  const line = { level, event, ...meta };
  if (level === "error") console.error(JSON.stringify(line));
  else if (level === "warn") console.warn(JSON.stringify(line));
  else console.log(JSON.stringify(line));
}

export const logger = {
  info: (event: string, meta?: Meta) => emit("info", event, meta),
  warn: (event: string, meta?: Meta) => emit("warn", event, meta),
  error: (event: string, meta?: Meta) => emit("error", event, meta),
  audit: (event: string, meta?: Meta) => emit("audit", event, meta),
};

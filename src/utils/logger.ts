export interface Logger {
  debug(message: string, metadata?: Record<string, unknown>): void;
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, metadata?: Record<string, unknown>): void;
}

function sanitize(value: unknown): unknown {
  if (typeof value === "string") {
    if (value.startsWith("data:image/")) return "[redacted image data URL]";
    if (value.toLowerCase().includes("authorization")) return "[redacted]";
    return value;
  }

  if (Array.isArray(value)) return value.map(sanitize);

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        key.toLowerCase().includes("authorization") || key.toLowerCase().includes("api")
          ? "[redacted]"
          : sanitize(entry)
      ])
    );
  }

  return value;
}

export const logger: Logger = {
  debug(message, metadata) {
    if (process.env.OCULAR_LOG_LEVEL === "debug") {
      console.error(message, metadata ? sanitize(metadata) : "");
    }
  },
  info(message, metadata) {
    console.error(message, metadata ? sanitize(metadata) : "");
  },
  warn(message, metadata) {
    console.error(message, metadata ? sanitize(metadata) : "");
  },
  error(message, metadata) {
    console.error(message, metadata ? sanitize(metadata) : "");
  }
};

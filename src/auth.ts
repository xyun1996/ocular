import { timingSafeEqual } from "node:crypto";

export interface HeaderAuthConfig {
  token: string;
  headerName: string;
  scheme: string;
}

export function authorizeHeaders(headers: Headers, config: HeaderAuthConfig): boolean {
  const presented = extractToken(headers, config);
  if (!presented) return false;
  return safeTokenEqual(presented, config.token);
}

export function extractToken(headers: Headers, config: HeaderAuthConfig): string | null {
  const raw = headers.get(config.headerName);
  if (!raw) return null;

  if (!config.scheme) {
    return raw.trim();
  }

  const prefix = `${config.scheme} `;
  if (!raw.toLowerCase().startsWith(prefix.toLowerCase())) {
    return null;
  }

  return raw.slice(prefix.length).trim();
}

export function createUnauthorizedResponse(): { error: string; message: string } {
  return {
    error: "Unauthorized",
    message: "Missing or invalid MCP authentication token."
  };
}

function safeTokenEqual(presented: string, expected: string): boolean {
  const presentedBuffer = Buffer.from(presented);
  const expectedBuffer = Buffer.from(expected);

  if (presentedBuffer.length !== expectedBuffer.length) {
    timingSafeEqual(expectedBuffer, expectedBuffer);
    return false;
  }

  return timingSafeEqual(presentedBuffer, expectedBuffer);
}

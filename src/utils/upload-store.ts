import { randomBytes } from "node:crypto";

export interface UploadedImage {
  buffer: Buffer;
  mimeType: string;
  expiresAt: number;
  used: boolean;
}

export interface UploadSession {
  uploadHandle: string;
  uploadUrl: string;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * In-memory store mapping a one-time uploadHandle to staged image bytes.
 *
 * Flow: createUploadSession() mints a handle -> client PUTs raw bytes to
 * /upload/:handle -> consume(handle) returns the staged buffer (single-use).
 *
 * This lets remote MCP clients ship binary image data through a side channel
 * (curl --data-binary) instead of inlining base64 in the JSON tool call,
 * which avoids corruption of large base64 strings in the MCP request path.
 */
export class UploadStore {
  private readonly store = new Map<string, UploadedImage>();
  private readonly ttlMs: number;

  constructor(ttlMs: number = DEFAULT_TTL_MS) {
    this.ttlMs = ttlMs;
  }

  createSession(uploadUrlBase: string, mimeType?: string): UploadSession {
    const handle = randomBytes(12).toString("hex");
    const expiresAt = Date.now() + this.ttlMs;
    this.store.set(handle, {
      buffer: Buffer.alloc(0),
      mimeType: mimeType ?? "image/png",
      expiresAt,
      used: false
    });
    return {
      uploadHandle: handle,
      uploadUrl: `${uploadUrlBase}/${handle}`,
      expiresAt
    };
  }

  stage(handle: string, buffer: Buffer, mimeType: string): void {
    const entry = this.store.get(handle);
    if (!entry) {
      throw new Error("Unknown or expired upload handle");
    }
    if (Date.now() > entry.expiresAt) {
      this.store.delete(handle);
      throw new Error("Upload handle expired");
    }
    entry.buffer = buffer;
    entry.mimeType = mimeType || entry.mimeType;
    entry.used = true;
  }

  /** Look up a handle's staged bytes without consuming. Multiple tool calls
   *  can reuse the same handle until it expires. */
  peek(handle: string): { buffer: Buffer; mimeType: string } | null {
    const entry = this.store.get(handle);
    if (!entry || !entry.used || Date.now() > entry.expiresAt || entry.buffer.length === 0) {
      return null;
    }
    return { buffer: entry.buffer, mimeType: entry.mimeType };
  }
}

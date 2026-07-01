import { UploadStore } from "./upload-store.js";

/**
 * Process-wide singleton upload store. Shared between the HTTP /upload endpoint
 * (which stages bytes) and the MCP tools (which resolve upload_handle -> image).
 *
 * The public base URL the server hands to clients for PUT uploads. Defaults to
 * the MCP_HTTP_PATH host:port; override via VISION_UPLOAD_URL_BASE when the
 * server sits behind a reverse proxy with a different public address.
 */
const uploadUrlBase =
  process.env.VISION_UPLOAD_URL_BASE ??
  `http://${process.env.MCP_HTTP_HOST ?? "127.0.0.1"}:${process.env.MCP_HTTP_PORT ?? "3000"}`;

export const UPLOAD_PATH = "/upload";

export const uploadStore = new UploadStore();

export function getUploadUrlBase(): string {
  return uploadUrlBase.replace(/\/+$/, "") + UPLOAD_PATH;
}

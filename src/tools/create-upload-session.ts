import { z } from "zod";
import type { VisionBridgeConfig } from "../config.js";
import { getPublicUploadUrl } from "../utils/upload-store-instance.js";

export const createUploadSessionSchema = {
  mime_type: z
    .enum(["image/png", "image/jpeg", "image/webp", "image/gif"])
    .default("image/png")
    .describe("MIME type of the image you will upload. Used in the curl Content-Type header.")
};

export interface UploadInstructions {
  upload_url: string;
  method: string;
  headers: Record<string, string>;
  auth_header: string;
  next_step: string;
  note: string;
}

/**
 * Stateless helper tool: returns the fixed PUT endpoint + auth header so the
 * LLM can upload a local image via curl --data-binary and receive a file_id.
 * No session is created -- the PUT itself is stateless and returns the file_id.
 */
export async function createUploadSession(
  args: { mime_type: string },
  config: VisionBridgeConfig
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const uploadUrl = getPublicUploadUrl(config);
  const authHeader = `${config.authScheme} ${config.authToken}`;

  const nextStep = [
    `Before uploading, verify the local image file exists and is non-empty:`,
    `  ls -la /path/to/your/image.${extFor(args.mime_type)}   # must show a non-zero size`,
    `If that fails, the file does not exist -- fix the path before proceeding.`,
    `Then upload the raw image bytes with curl (raw binary, NOT base64):`,
    `  curl --request PUT --data-binary @/path/to/your/image.${extFor(args.mime_type)} "${uploadUrl}" -H "Content-Type: ${args.mime_type}" -H "${config.authHeader}: ${authHeader}"`,
    `The response returns a file_id (content-addressed, deduplicated -- same image always yields the same file_id).`,
    `Then call any vision tool (e.g. analyze_image) passing file_id="<returned id>". The file_id is persistent across server restarts.`
  ].join("\n");

  const result: UploadInstructions = {
    upload_url: uploadUrl,
    method: "PUT",
    headers: { "Content-Type": args.mime_type, [config.authHeader]: authHeader },
    auth_header: `${config.authHeader}: ${authHeader}`,
    next_step: nextStep,
    note: "This call is stateless and returns fixed instructions. You only need to call it once to learn the upload endpoint; the actual upload returns file_id directly."
  };

  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
}

function extFor(mime: string): string {
  const map: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif"
  };
  return map[mime] ?? "png";
}

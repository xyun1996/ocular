import { z } from "zod";
import { getUploadUrlBase, uploadStore } from "../utils/upload-store-instance.js";

export const createUploadSessionSchema = {
  mime_type: z
    .enum(["image/png", "image/jpeg", "image/webp", "image/gif"])
    .default("image/png")
    .describe("MIME type of the image you will upload.")
};

export interface CreateUploadSessionResult {
  upload_handle: string;
  upload_url: string;
  method: string;
  headers: Record<string, string>;
  expires_at: string;
  next_step: string;
}

export async function createUploadSession(args: {
  mime_type: string;
}): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const session = uploadStore.createSession(getUploadUrlBase(), args.mime_type);

  const nextStep = [
    `Upload the local image bytes with curl (do NOT base64-encode):`,
    `  curl --request PUT --data-binary @/path/to/your/image.png "${session.uploadUrl}" -H "Content-Type: ${args.mime_type}"`,
    `Then call any vision tool (e.g. analyze_image) passing upload_handle="${session.uploadHandle}".`,
    `The handle is one-time-use for staging but can be passed to multiple tools before it expires.`
  ].join("\n");

  const result: CreateUploadSessionResult = {
    upload_handle: session.uploadHandle,
    upload_url: session.uploadUrl,
    method: "PUT",
    headers: { "Content-Type": args.mime_type },
    expires_at: new Date(session.expiresAt).toISOString(),
    next_step: nextStep
  };

  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
}

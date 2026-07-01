import { z } from "zod";
import { OcularError } from "../utils/errors.js";
import { base64ImageToDataUrl } from "../utils/image.js";
import { getUploadStore } from "../utils/upload-store-instance.js";

export const imageMimeTypeSchema = z
  .enum(["image/png", "image/jpeg", "image/webp", "image/gif"])
  .describe("MIME type for image_base64.");

export const base64ImageSchema = {
  image_base64: z
    .string()
    .optional()
    .describe("Raw base64-encoded image bytes, without a data: URL prefix. Prefer file_id for large images."),
  file_id: z
    .string()
    .optional()
    .describe("file_id returned by PUT /upload. Preferred over image_base64 to avoid corruption of large base64 in the tool-call path. Persistent across restarts, content-deduplicated."),
  mime_type: z
    .enum(["image/png", "image/jpeg", "image/webp", "image/gif"])
    .default("image/png")
    .describe("MIME type. Required with image_base64; ignored (uses stored value) with file_id.")
};

export const imageItemSchema = z.object(base64ImageSchema);

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export interface ImageInputArgs {
  image_base64?: string;
  file_id?: string;
  mime_type: string;
}

/** Resolve image input (either file_id or image_base64) into a data URL. */
export async function resolveImageDataUrl(args: ImageInputArgs): Promise<string> {
  if (args.file_id) {
    const stored = await getUploadStore().read(args.file_id);
    if (!stored) {
      throw new OcularError(
        "IMAGE_INPUT_MISSING",
        `file_id "${args.file_id}" is unknown or its file is missing. Upload the image first via PUT /upload (call create_upload_session for instructions).`
      );
    }
    return base64ImageToDataUrl(stored.buffer.toString("base64"), stored.mimeType);
  }

  if (args.image_base64) {
    return base64ImageToDataUrl(args.image_base64, args.mime_type);
  }

  throw new OcularError(
    "IMAGE_INPUT_MISSING",
    "Either image_base64 or file_id is required."
  );
}

export async function imageInputFromArgs(args: ImageInputArgs): Promise<{ imageDataUrl: string }> {
  return {
    imageDataUrl: await resolveImageDataUrl(args)
  };
}

export async function imageInputsFromArgs(args: { images: ImageInputArgs[] }): Promise<{ imageDataUrls: string[] }> {
  const urls = await Promise.all(args.images.map((image) => resolveImageDataUrl(image)));
  return { imageDataUrls: urls };
}

export { ALLOWED_MIME };

import { z } from "zod";
import { VisionBridgeError } from "../utils/errors.js";
import { base64ImageToDataUrl } from "../utils/image.js";
import { uploadStore } from "../utils/upload-store-instance.js";

export const imageMimeTypeSchema = z
  .enum(["image/png", "image/jpeg", "image/webp", "image/gif"])
  .describe("MIME type for image_base64.");

export const base64ImageSchema = {
  image_base64: z
    .string()
    .optional()
    .describe("Raw base64-encoded image bytes, without a data: URL prefix. Prefer upload_handle for large images."),
  upload_handle: z
    .string()
    .optional()
    .describe("Handle returned by create_upload_session after PUT-ing the image bytes. Preferred over image_base64 to avoid corruption of large base64 in the tool-call path."),
  mime_type: z
    .enum(["image/png", "image/jpeg", "image/webp", "image/gif"])
    .default("image/png")
    .describe("MIME type. Required with image_base64; ignored (uses staged value) with upload_handle.")
};

export const imageItemSchema = z.object(base64ImageSchema);

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export interface ImageInputArgs {
  image_base64?: string;
  upload_handle?: string;
  mime_type: string;
}

/** Resolve image input (either upload_handle or image_base64) into a data URL. */
export function resolveImageDataUrl(args: ImageInputArgs): string {
  if (args.upload_handle) {
    const staged = uploadStore.peek(args.upload_handle);
    if (!staged) {
      throw new VisionBridgeError(
        "IMAGE_INPUT_MISSING",
        `upload_handle "${args.upload_handle}" is unknown, expired, or has no staged bytes. Call create_upload_session, then PUT the image to the returned upload_url, then retry.`
      );
    }
    return base64ImageToDataUrl(staged.buffer.toString("base64"), staged.mimeType);
  }

  if (args.image_base64) {
    return base64ImageToDataUrl(args.image_base64, args.mime_type);
  }

  throw new VisionBridgeError(
    "IMAGE_INPUT_MISSING",
    "Either image_base64 or upload_handle is required."
  );
}

export function imageInputFromArgs(args: ImageInputArgs): { imageDataUrl: string } {
  return {
    imageDataUrl: resolveImageDataUrl(args)
  };
}

export function imageInputsFromArgs(args: { images: ImageInputArgs[] }): { imageDataUrls: string[] } {
  return {
    imageDataUrls: args.images.map((image) => resolveImageDataUrl(image))
  };
}

export { ALLOWED_MIME };

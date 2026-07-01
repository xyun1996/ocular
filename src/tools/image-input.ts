import { z } from "zod";
import { base64ImageToDataUrl } from "../utils/image.js";

export const imageMimeTypeSchema = z
  .enum(["image/png", "image/jpeg", "image/webp", "image/gif"])
  .describe("MIME type for image_base64.");

export const base64ImageSchema = {
  image_base64: z.string().describe("Raw base64-encoded image bytes, without a data: URL prefix."),
  mime_type: imageMimeTypeSchema
};

export const imageItemSchema = z.object(base64ImageSchema);

export interface Base64ImageArgs {
  image_base64: string;
  mime_type: string;
}

export function imageInputFromArgs(args: Base64ImageArgs): { imageDataUrl: string } {
  return {
    imageDataUrl: base64ImageToDataUrl(args.image_base64, args.mime_type)
  };
}

export function imageInputsFromArgs(args: { images: Base64ImageArgs[] }): { imageDataUrls: string[] } {
  return {
    imageDataUrls: args.images.map((image) => base64ImageToDataUrl(image.image_base64, image.mime_type))
  };
}

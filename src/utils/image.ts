import { createHash } from "node:crypto";
import { VisionBridgeError } from "./errors.js";

export interface ImageValidationOptions {
  maxImageMb: number;
}

const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif"
};

const SUPPORTED_MIME_TYPES = new Set(Object.values(MIME_TYPES));
const IMAGE_DATA_URL_PATTERN = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/]+={0,2})$/;

export function base64ImageToDataUrl(imageBase64: string, mimeType: string): string {
  validateMimeType(mimeType);
  validateBase64(imageBase64);
  return `data:${mimeType};base64,${imageBase64}`;
}

export function validateImageDataUrl(dataUrl: string, options: ImageValidationOptions): void {
  const { mimeType, base64 } = parseImageDataUrl(dataUrl);
  validateMimeType(mimeType);

  const maxBytes = options.maxImageMb * 1024 * 1024;
  if (Buffer.byteLength(base64, "base64") > maxBytes) {
    throw new VisionBridgeError(
      "IMAGE_FILE_TOO_LARGE",
      `Image file too large. Max size is ${options.maxImageMb} MB.`
    );
  }
}

export function hashImageDataUrl(dataUrl: string): string {
  const { base64 } = parseImageDataUrl(dataUrl);
  return createHash("sha256").update(Buffer.from(base64, "base64")).digest("hex");
}

function parseImageDataUrl(dataUrl: string): { mimeType: string; base64: string } {
  const match = IMAGE_DATA_URL_PATTERN.exec(dataUrl);
  if (!match) {
    throw new VisionBridgeError("INVALID_IMAGE_DATA_URL", "Image data URL must be data:image/...;base64,...");
  }
  return { mimeType: match[1], base64: match[2] };
}

function validateMimeType(mimeType: string): void {
  if (!SUPPORTED_MIME_TYPES.has(mimeType)) {
    throw new VisionBridgeError("UNSUPPORTED_IMAGE_FORMAT", `Unsupported image format: ${mimeType}`);
  }
}

function validateBase64(value: string): void {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw new VisionBridgeError("INVALID_IMAGE_BASE64", "Image base64 is invalid");
  }
}

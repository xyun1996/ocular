import { createHash } from "node:crypto";
import { OcularError } from "./errors.js";

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
    throw new OcularError(
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
    throw new OcularError("INVALID_IMAGE_DATA_URL", "Image data URL must be data:image/...;base64,...");
  }
  return { mimeType: match[1], base64: match[2] };
}

function validateMimeType(mimeType: string): void {
  if (!SUPPORTED_MIME_TYPES.has(mimeType)) {
    throw new OcularError("UNSUPPORTED_IMAGE_FORMAT", `Unsupported image format: ${mimeType}`);
  }
}

function validateBase64(value: string): void {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw new OcularError("INVALID_IMAGE_BASE64", "Image base64 is invalid");
  }
}

/**
 * Verify a buffer's magic bytes match the declared MIME type. Catches empty
 * files, truncated/corrupt uploads, and mismatched Content-Type headers
 * (e.g. curl sent a text error page as image/png).
 * Returns the detected MIME type, or null if the bytes are not a recognized image.
 */
export function detectImageMimeType(buffer: Buffer): string | null {
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 && buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a) {
    return "image/png";
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (buffer.length >= 6) {
    const head = buffer.slice(0, 6).toString("ascii");
    if (head === "GIF87a" || head === "GIF89a") return "image/gif";
  }
  if (buffer.length >= 12 && buffer.slice(0, 4).toString("ascii") === "RIFF" && buffer.slice(8, 12).toString("ascii") === "WEBP") {
    return "image/webp";
  }
  return null;
}

/**
 * Assert that buffer is a valid, non-empty image whose signature matches the
 * declared mimeType. Throws a OcularError with a helpful message on
 * mismatch -- used by the PUT /upload endpoint to fail fast on bad uploads
 * (empty body, wrong file, text/html error page, etc).
 */
export function assertValidImageBytes(buffer: Buffer, mimeType: string): void {
  if (buffer.length === 0) {
    throw new OcularError("INVALID_IMAGE_BASE64", "Uploaded file is empty. Check that the local file exists and is non-empty before uploading.");
  }
  const detected = detectImageMimeType(buffer);
  if (!detected) {
    throw new OcularError(
      "UNSUPPORTED_IMAGE_FORMAT",
      `Uploaded bytes do not match any supported image signature (png/jpeg/webp/gif). Got ${buffer.length} bytes; first bytes: ${buffer.slice(0, 16).toString("hex")}. This usually means the file does not exist, is not an image, or curl uploaded an error message instead.`
    );
  }
  if (detected !== mimeType) {
    throw new OcularError(
      "UNSUPPORTED_IMAGE_FORMAT",
      `Content-Type "${mimeType}" does not match the uploaded image signature (detected ${detected}). Send the correct Content-Type header.`
    );
  }
}

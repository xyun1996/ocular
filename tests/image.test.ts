import { describe, expect, test } from "vitest";
import {
  base64ImageToDataUrl,
  hashImageDataUrl,
  validateImageDataUrl
} from "../src/utils/image.js";

const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

describe("image utils", () => {
  test("converts base64 image input to a data URL", () => {
    expect(base64ImageToDataUrl(PNG_BASE64, "image/png")).toBe(`data:image/png;base64,${PNG_BASE64}`);
  });

  test("rejects unsupported MIME types", () => {
    expect(() => base64ImageToDataUrl(PNG_BASE64, "image/svg+xml")).toThrow("Unsupported image format");
  });

  test("rejects invalid base64", () => {
    expect(() => base64ImageToDataUrl("not base64!", "image/png")).toThrow("Image base64 is invalid");
  });

  test("rejects data URLs larger than max size", () => {
    const dataUrl = base64ImageToDataUrl(Buffer.alloc(2 * 1024 * 1024).toString("base64"), "image/png");

    expect(() => validateImageDataUrl(dataUrl, { maxImageMb: 1 })).toThrow(
      "Image file too large. Max size is 1 MB."
    );
  });

  test("hashes data URL image bytes", () => {
    const dataUrl = base64ImageToDataUrl(PNG_BASE64, "image/png");

    expect(hashImageDataUrl(dataUrl)).toHaveLength(64);
  });
});

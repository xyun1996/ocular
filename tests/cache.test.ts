import { describe, expect, test } from "vitest";
import { VisionCache } from "../src/utils/cache.js";
import { makeTempDir } from "./helpers.js";

const PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

describe("VisionCache", () => {
  test("hits cache for the same key", async () => {
    const dir = await makeTempDir();
    const cache = new VisionCache({ enabled: true, cacheDir: dir });
    const key = await cache.createKey({
      imageDataUrl: PNG_DATA_URL,
      tool: "analyze_image",
      task: "describe",
      model: "model-a",
      promptVersion: "v1",
      options: {}
    });

    await cache.write(key, {
      provider: "openai-compatible",
      model: "model-a",
      tool: "analyze_image",
      inputHash: "abc",
      result: { summary: "cached" }
    });

    await expect(cache.read(key)).resolves.toMatchObject({
      result: { summary: "cached" }
    });
  });

  test("does not share cache across tool, task, or model", async () => {
    const dir = await makeTempDir();
    const cache = new VisionCache({ enabled: true, cacheDir: dir });

    const base = {
      imageDataUrl: PNG_DATA_URL,
      tool: "analyze_image",
      task: "describe",
      model: "model-a",
      promptVersion: "v1",
      options: {}
    };

    const key = await cache.createKey(base);
    const differentTool = await cache.createKey({ ...base, tool: "extract_text_from_image" });
    const differentTask = await cache.createKey({ ...base, task: "ocr" });
    const differentModel = await cache.createKey({ ...base, model: "model-b" });

    expect(new Set([key, differentTool, differentTask, differentModel]).size).toBe(4);
  });

  test("does not read or write when disabled", async () => {
    const dir = await makeTempDir();
    const cache = new VisionCache({ enabled: false, cacheDir: dir });

    await cache.write("key", {
      provider: "openai-compatible",
      model: "model-a",
      tool: "analyze_image",
      inputHash: "abc",
      result: { summary: "cached" }
    });

    await expect(cache.read("key")).resolves.toBeNull();
  });
});

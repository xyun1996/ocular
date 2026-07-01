import { describe, expect, test, vi } from "vitest";
import type { OcularConfig } from "../src/config.js";
import type { VisionProvider } from "../src/providers/types.js";
import { analyzeImage } from "../src/tools/analyze-image.js";
import { runVisionTool } from "../src/tools/tool-runner.js";
import { makeTempDir } from "./helpers.js";

function makeConfig(cacheDir: string): OcularConfig {
  return {
    transport: "stdio",
    httpHost: "127.0.0.1",
    httpPort: 3000,
    httpPath: "/mcp",
    authHeader: "authorization",
    authScheme: "Bearer",
    provider: "openai-compatible",
    baseUrl: "https://api.example.com/v1",
    apiKey: "secret-key",
    model: "vision-model",
    headers: {},
    temperature: 0.1,
    maxTokens: 123,
    timeoutMs: 10_000,
    maxImageMb: 10,
    cacheEnabled: false,
    cacheDir
  };
}

describe("runVisionTool", () => {
  test("analyze_image accepts base64 MCP input", async () => {
    const dir = await makeTempDir();
    const imageBase64 =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";
    const analyze = vi.fn(async () => ({ text: "{\"summary\":\"ok\"}" }));
    const provider: VisionProvider = { analyze };

    const result = await analyzeImage(
      {
        image_base64: imageBase64,
        mime_type: "image/png",
        output_format: "json"
      },
      makeConfig(dir),
      provider
    );

    expect(analyze).toHaveBeenCalledWith(
      expect.objectContaining({
        imageDataUrl: `data:image/png;base64,${imageBase64}`
      })
    );
    expect(result.content[0].text).toContain("\"summary\": \"ok\"");
  });

  test("accepts a direct base64 image", async () => {
    const dir = await makeTempDir();
    const imageBase64 =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";
    const analyze = vi.fn(async () => ({ text: "{\"summary\":\"ok\"}" }));
    const provider: VisionProvider = { analyze };

    const result = await runVisionTool({
      toolName: "analyze_image",
      imageDataUrl: `data:image/png;base64,${imageBase64}`,
      systemPrompt: "system",
      userPrompt: "user",
      options: {},
      config: makeConfig(dir),
      provider
    });

    expect(analyze).toHaveBeenCalledWith(
      expect.objectContaining({
        imageDataUrl: `data:image/png;base64,${imageBase64}`,
        systemPrompt: "system",
        userPrompt: "user"
      })
    );
    expect(result.content[0].text).toContain("\"summary\": \"ok\"");
  });
});

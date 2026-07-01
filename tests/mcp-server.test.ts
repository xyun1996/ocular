import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { describe, expect, test } from "vitest";

describe("MCP server", () => {
  test("exposes all eight tools over stdio", async () => {
    const client = new Client({ name: "test-client", version: "0.0.0" }, { capabilities: {} });
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ["dist/index.js"],
      env: {
        OCULAR_PROVIDER: "openai-compatible",
        OCULAR_BASE_URL: "https://api.example.com/v1",
        OCULAR_API_KEY: "test-key",
        OCULAR_MODEL: "vision-model",
        OCULAR_CACHE_ENABLED: "false"
      }
    });

    await client.connect(transport);
    try {
      const tools = await client.listTools();
      expect(tools.tools.map((tool) => tool.name).sort()).toEqual([
        "analyze_chart_image",
        "analyze_image",
        "analyze_ui_screenshot",
        "compare_ui_screenshots",
        "create_upload_session",
        "diagnose_error_screenshot",
        "extract_table_from_image",
        "extract_text_from_image"
      ]);
    } finally {
      await client.close();
    }
  });
});

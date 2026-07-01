import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ListResourcesRequestSchema, ListPromptsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { VisionBridgeConfig } from "./config.js";
import type { VisionProvider } from "./providers/types.js";
import { analyzeChartImage, analyzeChartSchema } from "./tools/analyze-chart.js";
import { analyzeImage, analyzeImageSchema } from "./tools/analyze-image.js";
import { analyzeUiSchema, analyzeUiScreenshot } from "./tools/analyze-ui.js";
import { compareUiSchema, compareUiScreenshots } from "./tools/compare-ui.js";
import { createUploadSession, createUploadSessionSchema } from "./tools/create-upload-session.js";
import { diagnoseErrorSchema, diagnoseErrorScreenshot } from "./tools/diagnose-error.js";
import { extractTableFromImage, extractTableSchema } from "./tools/extract-table.js";
import { extractTextFromImage, extractTextSchema } from "./tools/extract-text.js";

export function createMcpServer(config: VisionBridgeConfig, provider: VisionProvider): McpServer {
  const server = new McpServer({
    name: "vision-bridge-mcp",
    version: "0.1.0"
  });

  server.tool(
    "analyze_image",
    "Analyze a general image and return structured JSON for a coding agent.",
    analyzeImageSchema,
    (args) => analyzeImage(args, config, provider)
  );

  server.tool(
    "extract_text_from_image",
    "Extract OCR text from screenshots, documents, tables, terminal output, or code images.",
    extractTextSchema,
    (args) => extractTextFromImage(args, config, provider)
  );

  server.tool(
    "analyze_ui_screenshot",
    "Analyze a webpage, app, UI, or design mockup screenshot for frontend implementation work.",
    analyzeUiSchema,
    (args) => analyzeUiScreenshot(args, config, provider)
  );

  server.tool(
    "diagnose_error_screenshot",
    "Analyze error, terminal, console, browser, or build failure screenshots.",
    diagnoseErrorSchema,
    (args) => diagnoseErrorScreenshot(args, config, provider)
  );

  server.tool(
    "compare_ui_screenshots",
    "Compare two UI screenshots and return implementation-useful visual differences.",
    compareUiSchema,
    (args) => compareUiScreenshots(args, config, provider)
  );

  server.tool(
    "extract_table_from_image",
    "Extract visible table data from an image as structured JSON, Markdown, or CSV-oriented output.",
    extractTableSchema,
    (args) => extractTableFromImage(args, config, provider)
  );

  server.tool(
    "analyze_chart_image",
    "Analyze a chart image and return labels, trends, approximate values, and limitations.",
    analyzeChartSchema,
    (args) => analyzeChartImage(args, config, provider)
  );

  server.tool(
    "create_upload_session",
    "Create a one-time upload session for staging a local image via a side channel (avoids base64 corruption of large images in the tool-call path). Returns an upload_url: PUT the raw image bytes there with curl --data-binary, then pass the returned upload_handle to any vision tool instead of image_base64.",
    createUploadSessionSchema,
    (args) => createUploadSession(args, config)
  );

  // Register empty resources and prompts handlers so that MCP clients
  // probing resources/list and prompts/list get an empty list instead of
  // a -32601 "Method not found" error.
  server.server.registerCapabilities({
    resources: { listChanged: true },
    prompts: { listChanged: true }
  });
  server.server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: [] }));
  server.server.setRequestHandler(ListPromptsRequestSchema, async () => ({ prompts: [] }));

  return server;
}

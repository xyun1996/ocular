#!/usr/bin/env node

const REQUIRED_ENV = ["OCULAR_BASE_URL", "OCULAR_API_KEY", "OCULAR_MODEL"];
const missingEnv = REQUIRED_ENV.filter((name) => !process.env[name]);
if (missingEnv.length) {
  console.error(`Missing required environment variables: ${missingEnv.join(", ")}`);
  console.error("Set an OpenAI-compatible vision endpoint before running this smoke test.");
  process.exit(2);
}

process.env.OCULAR_CACHE_ENABLED = "false";

const [{ loadConfig }, { createOcularProvider }, { analyzeImage }] = await Promise.all([
  import("../dist/config.js"),
  import("../dist/providers/provider-factory.js"),
  import("../dist/tools/analyze-image.js")
]);

const FIXTURE_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAIAAABMXPacAAAA3UlEQVR42u3TQQ3AMAwEQacYCsIgAqGPgDWIQsgjYILD0iyCs0YeJzM6981qvf8JAQAgAAAEAIAAABAAAAIAQAAACAAAAQAgAAAEAIAAABAAAAIAQAAACAAAAQAgAAAEAIAAABAAAAIAQAAACAAAAQAgAAAEAIAAABAAAAIAQAAAKEbWan3A/24fIAAABACAAAAQAAACAEAAAAgAAAEAIAAABACAAAAQAAACAEAAAAgAAAACAEAAAAgAAAEAIAAABACAAAAQAAACAEAAAAgAAAEAIAAABACAAAAQgO5dfqIGR0LFbwoAAAAASUVORK5CYII=";
const FIXTURE_SHA256 = "977860df384fb3a3b8664becc68aab20010dda4e5df34f6cd64c3ce0758b72a5";
const REQUIRED_FIELDS = [
  "image_type",
  "summary",
  "visible_text",
  "main_objects",
  "layout_or_structure",
  "important_details",
  "uncertain_points",
  "confidence"
];

function sanitizeBaseUrl(value) {
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return "[invalid-url]";
  }
}

const config = loadConfig();
const provider = createOcularProvider(config);
const startedAt = Date.now();

const response = await analyzeImage(
  {
    image_base64: FIXTURE_BASE64,
    mime_type: "image/png",
    task: "Describe the visible layout, dominant colors, and geometric regions. Keep observations factual.",
    output_format: "json"
  },
  config,
  provider
);

const text = response?.content?.[0]?.text;
if (!text) throw new Error("ocular returned no MCP text content");

let parsed;
try {
  parsed = JSON.parse(text);
} catch (error) {
  throw new Error(`ocular returned non-JSON text: ${error instanceof Error ? error.message : String(error)}`);
}

if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
  throw new Error("ocular returned JSON that is not an object");
}

const missingFields = REQUIRED_FIELDS.filter((field) => !(field in parsed));
if (missingFields.length) {
  throw new Error(`ocular response is missing expected fields: ${missingFields.join(", ")}`);
}

const result = {
  status: "pass",
  tested_at: new Date().toISOString(),
  provider_label: process.env.OCULAR_COMPAT_LABEL ?? "unspecified",
  provider: config.provider,
  base_url: sanitizeBaseUrl(config.baseUrl),
  model: config.model,
  tool: "analyze_image",
  duration_ms: Date.now() - startedAt,
  fixture: {
    mime_type: "image/png",
    sha256: FIXTURE_SHA256,
    description: "128x128 image with red, blue, green, and yellow quadrants"
  },
  assertions: {
    valid_mcp_text_content: true,
    valid_json_object: true,
    required_fields_present: REQUIRED_FIELDS
  }
};

console.log(JSON.stringify(result, null, 2));

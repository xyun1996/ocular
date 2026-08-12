#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_ENV = ["OCULAR_BASE_URL", "OCULAR_API_KEY", "OCULAR_MODEL"];
const missingEnv = REQUIRED_ENV.filter((name) => !process.env[name]);
if (missingEnv.length) {
  console.error(`Missing required environment variables: ${missingEnv.join(", ")}`);
  console.error("Set an OpenAI-compatible vision endpoint before running the fixture benchmark.");
  process.exit(2);
}

const cacheEnabled = process.env.OCULAR_BENCH_CACHE?.toLowerCase() === "true";
process.env.OCULAR_CACHE_ENABLED = cacheEnabled ? "true" : "false";
if (cacheEnabled && !process.env.OCULAR_CACHE_DIR) {
  process.env.OCULAR_CACHE_DIR = ".ocular-bench-cache";
}

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = resolve(rootDir, "bench/manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

const [
  { loadConfig },
  { createOcularProvider },
  { diagnoseErrorScreenshot },
  { analyzeUiScreenshot },
  { compareUiScreenshots },
  { extractTableFromImage },
  { analyzeChartImage }
] = await Promise.all([
  import("../dist/config.js"),
  import("../dist/providers/provider-factory.js"),
  import("../dist/tools/diagnose-error.js"),
  import("../dist/tools/analyze-ui.js"),
  import("../dist/tools/compare-ui.js"),
  import("../dist/tools/extract-table.js"),
  import("../dist/tools/analyze-chart.js")
]);

const EXPECTED_FIELDS = {
  diagnose_error_screenshot: [
    "image_type",
    "summary",
    "error_messages",
    "files_or_lines",
    "commands",
    "stack_trace",
    "likely_causes",
    "next_things_to_check",
    "search_keywords",
    "uncertain_points",
    "confidence"
  ],
  analyze_ui_screenshot: [
    "image_type",
    "summary",
    "ocr_text",
    "ui_elements",
    "layout",
    "visual_details",
    "issues",
    "implementation_hints",
    "uncertain_points",
    "confidence"
  ],
  compare_ui_screenshots: [
    "image_type",
    "summary",
    "screenshots",
    "similarities",
    "differences",
    "layout_differences",
    "visual_differences",
    "text_differences",
    "likely_regressions",
    "implementation_hints",
    "uncertain_points",
    "confidence"
  ],
  extract_table_from_image: [
    "image_type",
    "summary",
    "tables",
    "markdown",
    "csv",
    "notes",
    "uncertain_cells",
    "confidence"
  ],
  analyze_chart_image: [
    "image_type",
    "summary",
    "chart_type",
    "title",
    "axes",
    "legend",
    "series",
    "visible_values",
    "trends",
    "anomalies",
    "data_limitations",
    "uncertain_points",
    "confidence"
  ]
};

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

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

function parseToolResponse(response) {
  const text = response?.content?.[0]?.text;
  if (!text) throw new Error("tool returned no MCP text content");

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`tool returned non-JSON text: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("tool returned JSON that is not an object");
  }
  return parsed;
}

function assertFields(tool, parsed) {
  const expected = EXPECTED_FIELDS[tool];
  const missing = expected.filter((field) => !(field in parsed));
  if (missing.length) {
    throw new Error(`${tool} response is missing expected fields: ${missing.join(", ")}`);
  }
  return expected;
}

async function loadFixture(id) {
  const entry = manifest.fixtures.find((fixture) => fixture.id === id);
  if (!entry) throw new Error(`fixture not found in manifest: ${id}`);

  const buffer = await readFile(resolve(rootDir, entry.path));
  const actualSha = sha256(buffer);
  if (actualSha !== entry.sha256) {
    throw new Error(`fixture hash mismatch for ${id}: expected ${entry.sha256}, got ${actualSha}`);
  }

  return {
    ...entry,
    bytes: buffer.length,
    base64: buffer.toString("base64")
  };
}

const fixtures = Object.fromEntries(
  await Promise.all(manifest.fixtures.map(async (fixture) => [fixture.id, await loadFixture(fixture.id)]))
);

const config = loadConfig();
const provider = createOcularProvider(config);
const repeatCount = cacheEnabled ? 2 : 1;

const cases = [
  {
    id: "terminal-error-diagnosis",
    tool: "diagnose_error_screenshot",
    fixtureIds: ["terminal-error"],
    invoke: () => diagnoseErrorScreenshot(
      {
        image_base64: fixtures["terminal-error"].base64,
        mime_type: "image/png",
        task: "Extract exact visible error evidence and identify the next debugging checks.",
        project_context: "Synthetic Node.js TypeScript test failure fixture"
      },
      config,
      provider
    )
  },
  {
    id: "ui-reference-analysis",
    tool: "analyze_ui_screenshot",
    fixtureIds: ["ui-reference"],
    invoke: () => analyzeUiScreenshot(
      {
        image_base64: fixtures["ui-reference"].base64,
        mime_type: "image/png",
        task: "Describe the component hierarchy, layout, spacing, alignment, and visible implementation details.",
        framework_hint: "React + CSS",
        page_hint: "Synthetic login page reference"
      },
      config,
      provider
    )
  },
  {
    id: "ui-actual-analysis",
    tool: "analyze_ui_screenshot",
    fixtureIds: ["ui-actual"],
    invoke: () => analyzeUiScreenshot(
      {
        image_base64: fixtures["ui-actual"].base64,
        mime_type: "image/png",
        task: "Identify visible layout, sizing, alignment, and implementation defects.",
        framework_hint: "React + CSS",
        page_hint: "Synthetic login page with deliberate visual regression"
      },
      config,
      provider
    )
  },
  {
    id: "ui-reference-vs-actual",
    tool: "compare_ui_screenshots",
    fixtureIds: ["ui-reference", "ui-actual"],
    invoke: () => compareUiScreenshots(
      {
        images: [
          { image_base64: fixtures["ui-reference"].base64, mime_type: "image/png" },
          { image_base64: fixtures["ui-actual"].base64, mime_type: "image/png" }
        ],
        task: "Treat the first screenshot as reference and the second as actual. Identify visible regressions.",
        framework_hint: "React + CSS",
        page_hint: "Synthetic login page"
      },
      config,
      provider
    )
  },
  {
    id: "table-extraction",
    tool: "extract_table_from_image",
    fixtureIds: ["table"],
    invoke: () => extractTableFromImage(
      {
        image_base64: fixtures.table.base64,
        mime_type: "image/png",
        task: "Extract the visible API performance table exactly, preserving row/column order, values, and units.",
        output_format: "json"
      },
      config,
      provider
    )
  },
  {
    id: "chart-analysis",
    tool: "analyze_chart_image",
    fixtureIds: ["chart"],
    invoke: () => analyzeChartImage(
      {
        image_base64: fixtures.chart.base64,
        mime_type: "image/png",
        task: "Describe visible chart labels, approximate values, trend, and the annotated peak without inventing source data.",
        chart_hint: "line chart"
      },
      config,
      provider
    )
  }
];

async function runCase(testCase) {
  const attempts = [];
  let finalFields = [];

  for (let index = 0; index < repeatCount; index += 1) {
    const startedAt = performance.now();
    try {
      const response = await testCase.invoke();
      const durationMs = performance.now() - startedAt;
      const parsed = parseToolResponse(response);
      const expected = assertFields(testCase.tool, parsed);
      finalFields = Object.keys(parsed).sort();
      attempts.push({
        attempt: index + 1,
        role: index === 0 ? "cold" : "repeat/cache-candidate",
        status: "pass",
        duration_ms: Number(durationMs.toFixed(1)),
        required_fields_present: expected.length
      });
    } catch (error) {
      attempts.push({
        attempt: index + 1,
        role: index === 0 ? "cold" : "repeat/cache-candidate",
        status: "fail",
        duration_ms: Number((performance.now() - startedAt).toFixed(1)),
        error: error instanceof Error ? error.message : String(error)
      });
      break;
    }
  }

  return {
    id: testCase.id,
    tool: testCase.tool,
    status: attempts.every((attempt) => attempt.status === "pass") && attempts.length === repeatCount ? "pass" : "fail",
    fixtures: testCase.fixtureIds.map((id) => ({
      id,
      path: fixtures[id].path,
      sha256: fixtures[id].sha256,
      bytes: fixtures[id].bytes
    })),
    output_fields: finalFields,
    attempts
  };
}

const casesResult = [];
for (const testCase of cases) {
  casesResult.push(await runCase(testCase));
}

const result = {
  schema_version: 1,
  status: casesResult.every((entry) => entry.status === "pass") ? "pass" : "fail",
  tested_at: new Date().toISOString(),
  benchmark_label: process.env.OCULAR_BENCH_LABEL ?? "unspecified",
  provider: config.provider,
  base_url: sanitizeBaseUrl(config.baseUrl),
  model: config.model,
  node: process.version,
  manifest_version: manifest.version,
  cache_enabled: cacheEnabled,
  repeat_count: repeatCount,
  fixture_count: manifest.fixtures.length,
  case_count: cases.length,
  cases: casesResult
};

console.log(JSON.stringify(result, null, 2));
if (result.status !== "pass") process.exitCode = 1;

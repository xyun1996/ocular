# Vision Bridge MCP

`vision-bridge-mcp` is a TypeScript/Node.js MCP server that gives text-only coding agents image understanding. It accepts base64-encoded screenshots or images, sends them to an OpenAI-compatible vision model, and returns structured text or JSON that a coding agent can reason about.

The server exposes seven MCP tools:

- `analyze_image`
- `extract_text_from_image`
- `analyze_ui_screenshot`
- `diagnose_error_screenshot`
- `compare_ui_screenshots`
- `extract_table_from_image`
- `analyze_chart_image`

It does not provide a web UI, database, browser automation, image editing, or an OpenCode message transform plugin.

## Install

```bash
npm install
npm run build
```

Node.js 20 or newer is required.

## Configuration

Create a local `.env` file:

```env
VISION_PROVIDER=openai-compatible
MCP_TRANSPORT=stdio
VISION_BASE_URL=https://api.openai.com/v1
VISION_API_KEY=your_api_key
VISION_MODEL=gpt-4o-mini
VISION_HEADERS={}
VISION_TEMPERATURE=0.1
VISION_MAX_TOKENS=4096
VISION_TIMEOUT_MS=60000
VISION_MAX_IMAGE_MB=10
VISION_CACHE_ENABLED=true
VISION_CACHE_DIR=.vision-cache
```

For SiliconFlow Qwen:

```env
VISION_PROVIDER=openai-compatible
VISION_BASE_URL=https://api.siliconflow.cn/v1
VISION_MODEL=Qwen/Qwen3-VL-8B-Thinking
VISION_API_KEY=your_siliconflow_key
```

Use the `/v1` base URL. The server appends `/chat/completions`. A full `/v1/chat/completions` URL is also accepted.

## Start

Stdio mode, for local MCP clients:

```bash
node dist/index.js
```

HTTP mode, for private server deployment:

```env
MCP_TRANSPORT=http
MCP_HTTP_HOST=127.0.0.1
MCP_HTTP_PORT=3000
MCP_HTTP_PATH=/mcp
MCP_AUTH_TOKEN=replace_with_a_long_random_token
MCP_AUTH_HEADER=authorization
MCP_AUTH_SCHEME=Bearer
```

```bash
node dist/index.js
```

HTTP mode requires authentication. Requests must include:

```http
Authorization: Bearer replace_with_a_long_random_token
```

For public deployment, put the server behind HTTPS, bind the Node process to `127.0.0.1`, and expose it through Nginx/Caddy/Traefik. Do not expose plain HTTP directly to the public internet.

## MCP Client Example

```json
{
  "mcpServers": {
    "vision-bridge": {
      "command": "node",
      "args": ["/absolute/path/to/vision-bridge-mcp/dist/index.js"],
      "env": {
        "VISION_PROVIDER": "openai-compatible",
        "VISION_BASE_URL": "https://api.siliconflow.cn/v1",
        "VISION_MODEL": "Qwen/Qwen3-VL-8B-Thinking",
        "VISION_API_KEY": "your_api_key"
      }
    }
  }
}
```

## Claude Code

Local build:

```bash
claude mcp add vision-bridge -- node /absolute/path/to/vision-bridge-mcp/dist/index.js
```

If published as npm:

```bash
claude mcp add vision-bridge -- npx vision-bridge-mcp
```

## Codex

When Codex supports MCP in your environment, add `vision-bridge-mcp` as an MCP server. If the current Codex main model is text-only, do not pass images directly to Codex. First call `analyze_ui_screenshot`, `extract_text_from_image`, or `diagnose_error_screenshot`, then give the returned JSON to the text-only model.

## OpenCode

OpenCode can connect through MCP or through a future message transform plugin. This MVP only provides the MCP server. Automatic image fallback for text-only models would require an additional OpenCode plugin.

## Tools

### analyze_image

General image analysis.

Input:

```json
{
  "image_base64": "iVBORw0KGgo...",
  "mime_type": "image/png",
  "task": "Describe the image for a coding agent",
  "output_format": "json"
}
```

### extract_text_from_image

OCR for screenshots, documents, tables, code, terminals, and error images.

Input:

```json
{
  "image_base64": "iVBORw0KGgo...",
  "mime_type": "image/png",
  "preserve_layout": true,
  "language_hint": "English and Chinese",
  "output_format": "json"
}
```

### analyze_ui_screenshot

UI, webpage, app, or design screenshot analysis.

Input:

```json
{
  "image_base64": "iVBORw0KGgo...",
  "mime_type": "image/png",
  "task": "Find visual bugs and implementation hints",
  "framework_hint": "React + Tailwind",
  "page_hint": "Login page"
}
```

### diagnose_error_screenshot

Error, terminal, browser console, and build failure screenshot diagnosis.

Input:

```json
{
  "image_base64": "iVBORw0KGgo...",
  "mime_type": "image/png",
  "task": "Extract exact errors and next checks",
  "project_context": "Node.js TypeScript project"
}
```

### compare_ui_screenshots

Compare two UI screenshots. The first image is treated as reference/expected, the second as actual/implementation unless the task says otherwise.

Input:

```json
{
  "images": [
    {
      "image_base64": "iVBORw0KGgo...",
      "mime_type": "image/png"
    },
    {
      "image_base64": "iVBORw0KGgo...",
      "mime_type": "image/png"
    }
  ],
  "task": "Find visual regressions",
  "framework_hint": "React + Tailwind",
  "page_hint": "Dashboard"
}
```

### extract_table_from_image

Extract visible table data as structured JSON with Markdown/CSV-oriented fields.

Input:

```json
{
  "image_base64": "iVBORw0KGgo...",
  "mime_type": "image/png",
  "task": "Extract the table exactly",
  "output_format": "json"
}
```

### analyze_chart_image

Analyze chart type, labels, values, trends, and uncertainty.

Input:

```json
{
  "image_base64": "iVBORw0KGgo...",
  "mime_type": "image/png",
  "task": "Summarize the visible chart data",
  "chart_hint": "line chart"
}
```

## Base64 Image Analysis Example

With an MCP-capable client, call:

```json
{
  "tool": "analyze_ui_screenshot",
  "arguments": {
    "image_base64": "iVBORw0KGgo...",
    "mime_type": "image/png",
    "framework_hint": "React",
    "task": "Identify layout and visual issues"
  }
}
```

The response is MCP text content containing formatted JSON. If the vision model does not return valid JSON, the server returns:

```json
{
  "raw_text": "...",
  "parse_error": "...",
  "warning": "Vision model did not return valid JSON."
}
```

## Cache

Caching is enabled by default. The cache key includes image bytes, tool name, task, model, prompt version, and tool options. Cached files are written under `.vision-cache/`.

Disable it with:

```env
VISION_CACHE_ENABLED=false
```

## FAQ

### Does this log API keys, auth tokens, or base64 images?

No. The provider does not log request payloads, API keys, MCP auth tokens, or full base64 image data.

### Why Header auth instead of OAuth?

Header auth is the recommended first deployment mode for this server because it is easy to configure in MCP clients, reverse proxies, and private model gateways. OAuth can be added later when a real multi-user authorization server is needed.

### Can it read local paths or remote image URLs?

No. The MCP tools intentionally expose base64-only inputs for remote deployment. Clients should read the image bytes, base64 encode them, and pass `image_base64` plus `mime_type`.

### Which image formats are supported?

`png`, `jpg`, `jpeg`, `webp`, and `gif`.

### What happens when the image is too large?

The tool returns a structured error such as:

```json
{
  "error": {
    "code": "IMAGE_FILE_TOO_LARGE",
    "message": "Image file too large. Max size is 10 MB."
  }
}
```

## Development

```bash
npm install
npm run build
npm test
```

## TODO

- Add direct CLI commands for local manual testing.
- Add non-OpenAI provider adapters for Gemini, Claude Vision, DashScope, Z.ai, and local model servers.
- Add OAuth provider integration for multi-user deployments.
- Add bounding-box output when supported by the selected vision model.

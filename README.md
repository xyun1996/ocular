# ocular

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-green.svg)](https://nodejs.org/)
[![MCP](https://img.shields.io/badge/MCP-server-purple.svg)](https://modelcontextprotocol.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**MCP server that gives text-only coding agents vision.**

`ocular` lets text-only LLM agents (Claude Code, Codex, etc.) see and understand images — screenshots, UI mockups, error outputs, charts, documents, tables. It routes images through any OpenAI-compatible vision model (Qwen-VL, GPT-4o, etc.) and returns structured JSON the agent can reason about.

For remote (HTTP) deployments, images are uploaded through a **binary side channel** (`PUT /upload`) that returns a content-addressed `file_id`, then passed to tools instead of inline base64. This avoids corruption of large base64 strings in the MCP tool-call path — a known protocol-level limitation.

---

## Why

MCP tool calls are JSON over HTTP. Large base64 image strings get corrupted in the tool-call parameter path (some MCP clients mutate ~0.1% of characters in long base64, breaking image checksums). `ocular` ships image bytes through a dedicated binary upload endpoint, so any image size is reliable.

This mirrors the two-phase upload pattern used by other remote MCP servers (Contentful, FutureSearch): bulk data moves through a side channel, only a lightweight `file_id` travels through the protocol.

## Features

- **8 vision tools**: analyze image, OCR, UI screenshot, error diagnosis, UI compare, table extraction, chart analysis, upload helper
- **Binary upload side channel** with content-deduplication and disk persistence
- **Any OpenAI-compatible provider**: SiliconFlow, OpenAI, Azure, local models (Ollama, vLLM)
- **Structured JSON output** for agent consumption
- **Per-stage timing logs** for debugging latency
- **HTTP** (remote) and **stdio** (local) transports
- **Caching** keyed by image hash + tool + task + model

---

## Install

### Prerequisites

- Node.js 20 or newer

### From source

```bash
git clone https://github.com/xyun1996/ocular.git
cd ocular
npm install
npm run build
```

### As a dependency (once published)

```bash
npm install ocular
```

---

## Configuration

`ocular` reads config from environment variables (or a `.env` file in the working directory). Copy `.env.example` to `.env` and edit:

```env
# Provider (OpenAI-compatible)
OCULAR_PROVIDER=openai-compatible
OCULAR_BASE_URL=https://api.openai.com/v1
OCULAR_API_KEY=your_api_key
OCULAR_MODEL=gpt-4o-mini

# Optional custom headers (JSON string)
OCULAR_HEADERS={}

# Generation defaults
OCULAR_TEMPERATURE=0.1
OCULAR_MAX_TOKENS=4096
OCULAR_TIMEOUT_MS=60000

# Image size limit
OCULAR_MAX_IMAGE_MB=10

# Result cache (keyed by image hash + tool + task + model + prompt version)
OCULAR_CACHE_ENABLED=true
OCULAR_CACHE_DIR=.ocular-cache

# Binary upload store (disk-backed, content-deduplicated)
OCULAR_UPLOADS_DIR=.ocular-uploads
# Public base URL clients use to PUT images (defaults to http://<host>:<port>)
# OCULAR_UPLOAD_URL_BASE=http://your.public.host
```

### Provider examples

**OpenAI:**
```env
OCULAR_BASE_URL=https://api.openai.com/v1
OCULAR_MODEL=gpt-4o-mini
OCULAR_API_KEY=sk-...
```

**SiliconFlow Qwen-VL (recommended for cost):**
```env
OCULAR_BASE_URL=https://api.siliconflow.cn/v1
OCULAR_MODEL=Qwen/Qwen3-VL-8B-Instruct
OCULAR_API_KEY=sk-...
```

> Avoid the `-Thinking` variants (e.g. `Qwen3-VL-8B-Thinking`) for this use case — the reasoning step makes them ~25× slower (56s vs 2s) with much higher token consumption, with no quality benefit for structured image description.

**Local model (Ollama / vLLM):**
```env
OCULAR_BASE_URL=http://localhost:11434/v1
OCULAR_MODEL=qwen2.5-vl-7b
OCULAR_API_KEY=ollama
```

Use the `/v1` base URL — the server appends `/chat/completions`. A full `/v1/chat/completions` URL is also accepted.

---

## Running

### Stdio mode (local MCP client)

```bash
node dist/index.js
```

### HTTP mode (remote / private server)

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

HTTP mode requires authentication. Every request must include:

```http
Authorization: Bearer replace_with_a_long_random_token
```

For public deployment, bind the Node process to `127.0.0.1` and expose it through a reverse proxy with HTTPS. Do not expose plain HTTP directly to the public internet.

---

## Connecting MCP clients

### Claude Code (stdio, local)

```bash
claude mcp add ocular -- node /absolute/path/to/ocular/dist/index.js
```

With environment variables:

```bash
claude mcp add ocular \
  -e OCULAR_BASE_URL=https://api.siliconflow.cn/v1 \
  -e OCULAR_MODEL=Qwen/Qwen3-VL-8B-Instruct \
  -e OCULAR_API_KEY=sk-... \
  -- node /absolute/path/to/ocular/dist/index.js
```

### Claude Code / Claude Desktop (HTTP, remote)

Add to your MCP config (e.g. `~/.claude.json`):

```json
{
  "mcpServers": {
    "ocular": {
      "type": "http",
      "url": "https://your.host/mcp",
      "headers": {
        "Authorization": "Bearer your_mcp_auth_token"
      }
    }
  }
}
```

### Generic MCP client config

```json
{
  "mcpServers": {
    "ocular": {
      "command": "node",
      "args": ["/absolute/path/to/ocular/dist/index.js"],
      "env": {
        "OCULAR_PROVIDER": "openai-compatible",
        "OCULAR_BASE_URL": "https://api.siliconflow.cn/v1",
        "OCULAR_MODEL": "Qwen/Qwen3-VL-8B-Instruct",
        "OCULAR_API_KEY": "your_api_key"
      }
    }
  }
}
```

---

## Uploading images (remote deployments)

For remote HTTP deployments, **upload images through the binary side channel** and pass a `file_id` to tools, instead of inlining base64.

### Three-step flow

```bash
# 1. (optional) Get upload instructions + auth header
#    Call the create_upload_session MCP tool. It returns the upload_url and
#    a curl example. Stateless — safe to call once, or skip if you know the endpoint.

# 2. Upload raw image bytes (NOT base64)
curl --request PUT \
  --data-binary @/path/to/image.png \
  "https://your.host/upload" \
  -H "Content-Type: image/png" \
  -H "Authorization: Bearer your_mcp_auth_token"
# => {"ok":true,"file_id":"e21ba723...","bytes":8291,"mime_type":"image/png","dedup":false}

# 3. Call any vision tool with file_id
#    analyze_image({ "file_id": "e21ba723...", "task": "describe" })
```

### How it works

- **`file_id` = `sha256(image bytes)`** (first 40 hex chars). Same image always yields the same id — uploading the same file twice returns the existing id without rewriting (`dedup: true`).
- **Disk-backed.** Bytes stored at `.ocular-uploads/{file_id}.{ext}`, metadata in `index.json`. Survives process restarts — on startup the store reconciles the index against the directory (adopts orphan files, drops missing entries).
- **Stateless PUT.** `PUT /upload` takes raw bytes and returns `file_id` directly. No session, no TTL.
- **Image signature validation.** The server checks magic bytes against the declared `Content-Type`, rejecting empty bodies, non-image uploads, and mismatched types with clear errors.
- **LLM orchestration.** The `create_upload_session` tool's response includes a `next_step` field with the exact `curl` command. Claude Code (which has a Bash tool) reads this and auto-orchestrates all three steps from a single request like "analyze ./screenshot.png".

### `file_id` vs `image_base64`

| | `file_id` (upload) | `image_base64` (inline) |
|---|---|---|
| Remote HTTP server | ✅ Recommended | ⚠️ Corrupts for large images |
| Local stdio server | works | ✅ Fine (same machine) |
| Small images (< ~4 KB) | works | ✅ Works |
| Large images | ✅ Reliable | ❌ Corrupts |
| Dedup across calls | ✅ Free | ❌ None |
| Persistence across restarts | ✅ | ❌ Must resend every call |

Both inputs are accepted by every tool; `file_id` takes precedence when both are present.

---

## Tools

### analyze_image
General image analysis. Returns structured JSON: `image_type`, `summary`, `visible_text`, `main_objects`, `layout_or_structure`, `important_details`, `uncertain_points`, `confidence`.

```json
{ "file_id": "e21ba723...", "task": "Describe the image for a coding agent", "output_format": "json" }
```

### extract_text_from_image
OCR for screenshots, documents, tables, code, terminals, error images. Preserves reading order, headings, lists, tables, code blocks.

```json
{ "file_id": "e21ba723...", "preserve_layout": true, "language_hint": "English and Chinese", "output_format": "json" }
```

### analyze_ui_screenshot
UI / webpage / app / design screenshot analysis. Focuses on component hierarchy, layout, alignment, spacing, color/contrast, typography, accessibility.

```json
{ "file_id": "e21ba723...", "task": "Find visual bugs and implementation hints", "framework_hint": "React + Tailwind", "page_hint": "Login page" }
```

### diagnose_error_screenshot
Error / terminal / browser console / build failure diagnosis. Preserves exact error messages, file:line, commands, stack traces; suggests next checks.

```json
{ "file_id": "e21ba723...", "task": "Extract exact errors and next checks", "project_context": "Node.js TypeScript project" }
```

### compare_ui_screenshots
Compare two UI screenshots (first = reference/expected, second = actual/implementation). Returns similarities, differences, likely regressions.

```json
{
  "images": [
    { "file_id": "e21ba723ad73804027dc61dfd04a514624a8dcd0" },
    { "file_id": "9f2c8a1b0e7d4c5f6a2b3c8d1e9f0a7b3c5d8e1f" }
  ],
  "task": "Find visual regressions",
  "framework_hint": "React + Tailwind"
}
```

Each image entry accepts `file_id` or `image_base64` + `mime_type` (mixed allowed).

### extract_table_from_image
Extract visible table data as structured JSON with Markdown/CSV-oriented fields. Preserves row/column order, exact text, numbers, units.

```json
{ "file_id": "e21ba723...", "task": "Extract the table exactly", "output_format": "json" }
```

### analyze_chart_image
Analyze chart type, labels, values, trends, uncertainty.

```json
{ "file_id": "e21ba723...", "task": "Summarize the visible chart data", "chart_hint": "line chart" }
```

### create_upload_session
Stateless helper that returns the upload endpoint, auth header, and a `curl` example for the binary side channel. Call once to learn how to upload; the actual `PUT /upload` returns `file_id` directly.

```json
{ "mime_type": "image/png" }
```

---

## Deployment

### Behind Nginx

The MCP endpoint (`/mcp`) and the binary upload endpoint (`/upload`) must both be proxied. Use `location /upload` **without** a trailing slash, otherwise nginx 301-redirects `PUT /upload` to `/upload/` and uploads fail:

```nginx
server {
    listen 80;
    server_name _;
    client_max_body_size 20m;

    location /mcp {
        proxy_pass http://127.0.0.1:3000/mcp;
        proxy_http_version 1.1;
        proxy_set_header Host 127.0.0.1;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }

    location /upload {
        proxy_pass http://127.0.0.1:3000/upload;
        proxy_http_version 1.1;
        proxy_set_header Host 127.0.0.1;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 20m;
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }
}
```

Set `OCULAR_UPLOAD_URL_BASE` to the public base URL so `create_upload_session` hands clients a reachable upload URL:

```env
OCULAR_UPLOAD_URL_BASE=https://your.public.host
```

### systemd

```ini
[Unit]
Description=ocular MCP server
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/ocular
EnvironmentFile=/opt/ocular/.env
ExecStart=/usr/bin/node /opt/ocular/dist/index.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

### Timing logs

`ocular` emits per-stage timing logs to stderr (prefix `[ocular]`), covering HTTP request, tool validate/cache/provider/parse, and provider fetch + token usage. Useful for locating latency bottlenecks:

```bash
journalctl -u ocular -o cat | grep '\[ocular\]'
```

---

## Development

```bash
npm install
npm run build      # TypeScript compile
npm test           # vitest
npm run dev        # tsx src/index.ts (live reload)
```

---

## FAQ

### Does it log API keys, auth tokens, or image data?

No. The provider does not log request payloads, API keys, MCP auth tokens, or full image data. Timing logs include only metadata (file_id, byte count, mime type, token counts).

### Can it read local file paths or remote image URLs directly?

No. Tools accept `file_id` (from the upload side channel) or `image_base64` (inline) — not filesystem paths or URLs. For remote deployments, upload via `PUT /upload` and pass `file_id`. For local stdio, inline `image_base64` is fine.

### How does `file_id` deduplication work?

`file_id` is the first 40 hex chars of `sha256(image bytes)`. The same content always produces the same id, so a second upload of identical bytes is a no-op (returns the existing id with `dedup: true`, writes nothing). Dedup is global — across tools, sessions, and restarts.

### Do uploads survive a server restart?

Yes. Uploaded bytes live on disk under `OCULAR_UPLOADS_DIR` with metadata in `index.json`. On startup the store reconciles the index against the directory. There is no TTL — uploads persist until deleted manually.

### Which image formats are supported?

`png`, `jpg`, `jpeg`, `webp`, and `gif`.

### What happens when the image is too large or invalid?

The server returns a structured error:

```json
{ "error": { "code": "IMAGE_FILE_TOO_LARGE", "message": "Image file too large. Max size is 10 MB." } }
```

For uploads, invalid images (empty, non-image bytes, signature mismatch) are rejected at `PUT /upload` with a clear message pointing at the likely cause (file missing, not an image, wrong Content-Type).

---

## License

MIT

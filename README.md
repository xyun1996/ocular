# Vision Bridge MCP

`vision-bridge-mcp` is a TypeScript/Node.js MCP server that gives text-only coding agents image understanding. It accepts base64-encoded screenshots or images, sends them to an OpenAI-compatible vision model, and returns structured text or JSON that a coding agent can reason about.

For remote (HTTP) deployments, large images should be uploaded through a binary side channel (`PUT /upload`) that returns a content-addressed `file_id`, then passed to tools instead of base64. This avoids corruption of large base64 strings in the MCP tool-call path. See [Upload (remote deployments)](#upload-remote-deployments).

The server exposes eight MCP tools:

- `analyze_image`
- `extract_text_from_image`
- `analyze_ui_screenshot`
- `diagnose_error_screenshot`
- `compare_ui_screenshots`
- `extract_table_from_image`
- `analyze_chart_image`
- `create_upload_session` — returns upload instructions for the binary side channel (stateless helper)

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
VISION_UPLOADS_DIR=.vision-uploads
VISION_UPLOAD_URL_BASE=http://127.0.0.1:3000
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

### Nginx

The MCP endpoint (`/mcp`) and the binary upload endpoint (`/upload`) must both be proxied. Use a `location /upload` block **without** a trailing slash, otherwise nginx 301-redirects `PUT /upload` to `/upload/` and the upload fails:

```nginx
server {
    listen 80;
    server_name _;
    client_max_body_size 20m;

    location /mcp {
        proxy_pass http://127.0.0.1:37377/mcp;
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
        proxy_pass http://127.0.0.1:37377/upload;
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

Set `VISION_UPLOAD_URL_BASE` to the public base URL so the `create_upload_session` tool hands clients a reachable upload URL (defaults to `http://<MCP_HTTP_HOST>:<MCP_HTTP_PORT>`):

```env
VISION_UPLOAD_URL_BASE=http://your.public.host
```

## Upload (remote deployments)

MCP tool calls are JSON over HTTP, and the tool-call parameter path can corrupt large base64 strings (some MCP clients mutate ~0.1% of characters in long base64, breaking image checksums). For remote HTTP deployments, upload images through a binary side channel and pass a short `file_id` to the tools instead.

This mirrors the two-phase upload pattern used by other remote MCP servers (Contentful, FutureSearch) — bulk data moves through a side channel, only a lightweight reference travels through the protocol.

### How it works

1. **Get upload instructions** (optional, stateless) — call the `create_upload_session` tool. It returns the fixed `upload_url`, the auth header, and a `curl` example. It creates no state and is safe to call once or skip if the client already knows the endpoint.
2. **Upload raw bytes** — `PUT` the image bytes directly (do not base64-encode) to `upload_url` with `Content-Type: image/<format>` and the MCP auth header. The server hashes the bytes and returns a `file_id`:
   ```
   curl --request PUT --data-binary @/path/to/image.png "$UPLOAD_URL" \
     -H "Content-Type: image/png" \
     -H "Authorization: Bearer $MCP_AUTH_TOKEN"
   => {"ok":true,"file_id":"e21ba723...","bytes":8291,"dedup":false}
   ```
3. **Call any vision tool** with `file_id` instead of `image_base64`:
   ```json
   { "tool": "analyze_image", "arguments": { "file_id": "e21ba723...", "task": "describe" } }
   ```

### Implementation details

- **Content-addressed `file_id`.** `file_id = sha256(image bytes)` (first 40 hex chars). The same image always yields the same `file_id`, so uploading the same file twice returns the existing id without rewriting bytes (`dedup: true` in the response).
- **Disk-backed.** Bytes are stored at `.vision-uploads/{file_id}.{ext}` (configurable via `VISION_UPLOADS_DIR`). Metadata lives in `.vision-uploads/index.json`. Nothing is kept in process memory across requests, so uploads survive process restarts.
- **Restart-safe.** On startup the store reconciles `index.json` against the directory: orphan files on disk are adopted into the index, and index entries whose file is missing are dropped. A `file_id` obtained before a restart stays valid after.
- **Deduplication.** Because `file_id` is a content hash, dedup is automatic and global — across tools, across sessions, across restarts. Repeated analysis of the same screenshot reuses one on-disk copy.
- **Stateless PUT.** `PUT /upload` takes raw bytes and returns `file_id` directly. There is no session, no TTL, no two-step state — the LLM orchestration is `create_upload_session` (optional, for instructions) → `curl PUT` → `analyze_image`, and only the middle step can fail (network), with no ordering/timeout coupling between steps.
- **Auth.** The upload endpoint uses the same `MCP_AUTH_TOKEN` / header scheme as the MCP endpoint. `create_upload_session` echoes the auth header value so the LLM can use it without it being baked into tool descriptions.
- **LLM orchestration.** The `create_upload_session` tool's response includes a `next_step` field with the exact `curl` command. Claude Code (which has a Bash tool) reads this and auto-orchestrates the three steps from a single natural-language request like "analyze ./screenshot.png".

### When to use `file_id` vs `image_base64`

| | `file_id` (upload) | `image_base64` (inline) |
|---|---|---|
| Remote HTTP server | ✅ Recommended | ⚠️ Corrupts for large images |
| Local stdio server | works | ✅ Fine (same machine, no corruption) |
| Small images (< ~4 KB) | works | ✅ Works |
| Large images | ✅ Reliable | ❌ Corrupts |
| Dedup across calls | ✅ Free | ❌ None |
| Persistence across restarts | ✅ | ❌ Must resend every call |

Both inputs are accepted by every tool; `file_id` takes precedence when both are present.

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

Input (remote: upload first, pass `file_id`):

```json
{
  "file_id": "e21ba723ad73804027dc61dfd04a514624a8dcd0",
  "task": "Describe the image for a coding agent",
  "output_format": "json"
}
```

Or inline base64 (local / small images):

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
    { "file_id": "e21ba723ad73804027dc61dfd04a514624a8dcd0" },
    { "file_id": "9f2c8a1b0e7d4c5f6a2b3c8d1e9f0a7b3c5d8e1f" }
  ],
  "task": "Find visual regressions",
  "framework_hint": "React + Tailwind",
  "page_hint": "Dashboard"
}
```

Each image entry accepts `file_id` or `image_base64` + `mime_type` (mixed allowed).

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

No. Tools accept `image_base64` (inline) or `file_id` (from the binary upload side channel) — not filesystem paths or URLs. For remote deployments, upload the image via `PUT /upload` and pass the returned `file_id`. For local stdio deployments, inline `image_base64` is fine.

Why not just inline base64 for everything? The MCP tool-call parameter path can corrupt large base64 strings (a protocol/client-level limitation, not specific to this server). The upload side channel ships raw bytes outside the JSON path, so it is reliable for any size. See [Upload (remote deployments)](#upload-remote-deployments).

### Which image formats are supported?

`png`, `jpg`, `jpeg`, `webp`, and `gif`.

### How does `file_id` deduplication work?

`file_id` is the first 40 hex chars of `sha256(image bytes)`. The same image content always produces the same `file_id`, so a second upload of identical bytes is a no-op: the server returns the existing `file_id` with `dedup: true` and writes nothing. Dedup is global — across tools, sessions, and restarts — and costs no extra disk for repeats.

### Do uploads survive a server restart?

Yes. Uploaded bytes live on disk under `VISION_UPLOADS_DIR` (default `.vision-uploads/`), with metadata in `index.json`. On startup the store reconciles the index against the directory (adopts orphan files, drops index entries whose file is gone), so a `file_id` obtained before a restart stays valid after. There is no TTL — uploads persist until the files are deleted manually.

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

# Claude Code + ocular

This walkthrough connects the published `ocular` MCP server to Claude Code and uses a vision-capable OpenAI-compatible provider to inspect screenshots.

## Prerequisites

- Node.js 20+
- Claude Code installed
- An API key for an OpenAI-compatible multimodal provider, or a local compatible endpoint

## Install ocular

The published npm package is `ocular-mcp`. It exposes the CLI command `ocular`.

You can use it without a global install:

```bash
npx -y ocular-mcp
```

Or install it globally:

```bash
npm install -g ocular-mcp
ocular
```

To work on the source instead:

```bash
git clone https://github.com/xyun1996/ocular.git
cd ocular
npm install
npm run build
```

## Option A: register the npm package directly

Pass provider settings when registering the MCP server:

```bash
claude mcp add ocular \
  -e OCULAR_BASE_URL=https://your-openai-compatible-endpoint.example/v1 \
  -e OCULAR_MODEL=your_vision_model \
  -e OCULAR_API_KEY=your_api_key \
  -- npx -y ocular-mcp
```

Avoid putting real API keys in shell history on shared machines. Prefer your client's environment or secret-management mechanism for persistent setups.

## Option B: run from source

Create a local `.env` file:

```bash
cp .env.example .env
```

Example:

```env
OCULAR_BASE_URL=https://your-openai-compatible-endpoint.example/v1
OCULAR_API_KEY=your_api_key
OCULAR_MODEL=your_vision_model
```

Build and register the local server:

```bash
npm run build
claude mcp add ocular -- node /absolute/path/to/ocular/dist/index.js
```

## Suggested prompts

Once connected, try workflows such as:

```text
Use ocular to inspect this screenshot. Extract the exact error text, identify the likely cause, and tell me which source files or commands I should inspect next.
```

```text
Use ocular to review this UI screenshot. Focus on hierarchy, alignment, spacing, typography, contrast, and implementation clues for a React + Tailwind app.
```

```text
Use ocular to compare the reference screenshot and my current implementation. List visual regressions in priority order and suggest concrete CSS/layout fixes.
```

## Local image transport

In local stdio mode the client and server share the same machine. The vision tools support inline image data, while remote deployments should generally use the binary upload flow described in [`../docs/architecture.md`](../docs/architecture.md).

## Provider compatibility

An endpoint advertising an OpenAI-compatible API is not automatically considered verified. See [`../docs/provider-compatibility.md`](../docs/provider-compatibility.md) for the reproducible smoke-test procedure and tested endpoint/model combinations.

## Troubleshooting

### Provider request fails

Verify:

- `OCULAR_BASE_URL` points to the provider's OpenAI-compatible base URL.
- `OCULAR_MODEL` is vision-capable.
- `OCULAR_API_KEY` is valid for that provider.
- The endpoint accepts the multimodal request shape ocular sends.

### Server does not start

For the npm package, confirm the installed CLI reaches ocular's configuration validation:

```bash
npx -y ocular-mcp
```

For a source checkout, run:

```bash
npm run check
npm run dev
```

### Need a remote server

See [`../docs/deployment.md`](../docs/deployment.md) for authenticated HTTP deployment and the binary upload endpoint.

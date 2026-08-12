# Claude Code + ocular

This walkthrough connects a local `ocular` server to Claude Code and uses a vision-capable provider to inspect screenshots.

## Prerequisites

- Node.js 20+
- Claude Code installed
- An API key for an OpenAI-compatible vision provider, or a local compatible endpoint

## Build ocular

```bash
git clone https://github.com/xyun1996/ocular.git
cd ocular
npm install
npm run build
```

## Option A: configure through `.env`

```bash
cp .env.example .env
```

Example:

```env
OCULAR_BASE_URL=https://api.openai.com/v1
OCULAR_API_KEY=your_api_key
OCULAR_MODEL=gpt-4o-mini
```

Register the local MCP server:

```bash
claude mcp add ocular -- node /absolute/path/to/ocular/dist/index.js
```

## Option B: pass provider settings when registering

```bash
claude mcp add ocular \
  -e OCULAR_BASE_URL=https://api.openai.com/v1 \
  -e OCULAR_MODEL=gpt-4o-mini \
  -e OCULAR_API_KEY=your_api_key \
  -- node /absolute/path/to/ocular/dist/index.js
```

Avoid putting real API keys in shell history on shared machines. An environment file or secret-management approach is preferable for persistent setups.

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

## Troubleshooting

### Provider request fails

Verify:

- `OCULAR_BASE_URL` points to the provider's OpenAI-compatible base URL.
- `OCULAR_MODEL` is vision-capable.
- `OCULAR_API_KEY` is valid for that provider.
- The provider accepts the OpenAI-compatible multimodal request shape.

### Server does not start

Run the project checks directly:

```bash
npm run check
```

Then run the server in development mode to inspect stderr output:

```bash
npm run dev
```

### Need a remote server

See [`../docs/deployment.md`](../docs/deployment.md) for authenticated HTTP deployment and the binary upload endpoint.

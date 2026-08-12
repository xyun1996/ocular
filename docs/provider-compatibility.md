# Provider compatibility

`ocular` talks to vision models through an OpenAI-compatible chat-completions interface. Compatibility should be reported only after running a reproducible smoke test against a specific endpoint and model.

## What the smoke test verifies

The repository includes `scripts/provider-smoke.mjs`. It exercises the real `ocular` path:

1. load the normal `OcularConfig` environment configuration;
2. create the project's `OpenAICompatibleVisionProvider`;
3. call the real `analyze_image` tool with a deterministic embedded PNG fixture;
4. require MCP text content containing a JSON object;
5. require the documented `analyze_image` fields to be present;
6. emit a machine-readable result with endpoint/model metadata and elapsed time.

It intentionally does **not** assert exact model wording. The purpose is protocol and project compatibility, not a model-quality benchmark.

The fixture is a 128×128 PNG divided into red, blue, green, and yellow quadrants. Its SHA-256 is:

```text
977860df384fb3a3b8664becc68aab20010dda4e5df34f6cd64c3ce0758b72a5
```

## Run a compatibility check

Configure the same variables used by `ocular`:

```bash
export OCULAR_BASE_URL="https://your-openai-compatible-endpoint/v1"
export OCULAR_API_KEY="your-api-key"
export OCULAR_MODEL="your-vision-model"
export OCULAR_COMPAT_LABEL="provider-or-deployment-name"

npm run smoke:provider
```

You may also place the normal `OCULAR_*` variables in `.env`. Never commit credentials or private endpoint tokens.

A passing run prints JSON similar to:

```json
{
  "status": "pass",
  "tested_at": "2026-08-12T00:00:00.000Z",
  "provider_label": "example-provider",
  "provider": "openai-compatible",
  "base_url": "https://example.invalid/v1",
  "model": "example-vision-model",
  "tool": "analyze_image",
  "duration_ms": 1234,
  "fixture": {
    "mime_type": "image/png",
    "sha256": "977860df384fb3a3b8664becc68aab20010dda4e5df34f6cd64c3ce0758b72a5",
    "description": "128x128 image with red, blue, green, and yellow quadrants"
  }
}
```

The emitted base URL removes credentials, query parameters, and fragments, but review output before publishing it if the hostname or path is private.

## Compatibility matrix

Only add rows after a real smoke run. Record the exact model and test date so future maintainers can distinguish verified configurations from theoretical compatibility.

| Provider / deployment | Model | Endpoint style | Last verified | `analyze_image` smoke | Notes |
|---|---|---|---|---|---|
| _No published verification yet_ | — | — | — | — | Run `npm run smoke:provider` against a real endpoint before adding a claim. |

## Suggested initial coverage

The first useful matrix should include, when credentials or local deployments are available:

- an OpenAI-hosted compatible vision model;
- an Ollama OpenAI-compatible local endpoint;
- a vLLM OpenAI-compatible endpoint;
- one additional third-party provider already used by a real `ocular` user.

A passing `analyze_image` smoke test establishes a baseline only. Broader compatibility work should subsequently exercise OCR, UI analysis, error diagnosis, table/chart extraction, comparison, and remote upload workflows where relevant.

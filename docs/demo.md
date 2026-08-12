# Demo: from screenshot to coding-agent evidence

This walkthrough shows the intended `ocular` workflow for a coding agent that needs visual context.

> The output below is **representative**, not a benchmark or a captured provider response. The field names match the current tool prompts and are included to show the shape of information a coding agent can consume.

## Scenario

A developer has a screenshot of a failed TypeScript build. The coding agent can inspect the repository, but it cannot reliably read the screenshot itself.

With `ocular`, the image becomes structured evidence that the agent can combine with repository-level reasoning.

## 1. Upload the image

For a remote HTTP deployment, send the raw image bytes through the binary side channel:

```bash
curl --request PUT \
  --data-binary @./build-error.png \
  "https://your.host/upload" \
  -H "Content-Type: image/png" \
  -H "Authorization: Bearer your_mcp_auth_token"
```

The upload endpoint returns a content-addressed `file_id`:

```json
{
  "ok": true,
  "file_id": "e21ba723...",
  "bytes": 8291,
  "mime_type": "image/png",
  "dedup": false
}
```

The coding agent can reuse that `file_id` across vision-tool calls without moving the image bytes through MCP again.

## 2. Ask ocular to diagnose the screenshot

Call `diagnose_error_screenshot`:

```json
{
  "file_id": "e21ba723...",
  "task": "Extract the exact visible error, preserve file and line references, separate facts from likely causes, and tell me what to inspect next.",
  "project_context": "Node.js 20 + TypeScript project"
}
```

The tool is designed to return JSON fields including:

- `image_type`
- `summary`
- `error_messages`
- `files_or_lines`
- `commands`
- `stack_trace`
- `likely_causes`
- `next_things_to_check`
- `search_keywords`
- `uncertain_points`
- `confidence`

A representative result could look like:

```json
{
  "image_type": "terminal_error",
  "summary": "TypeScript compilation failed because a referenced property is not present on the inferred type.",
  "error_messages": [
    "TS2339: Property 'status' does not exist on type 'Result'."
  ],
  "files_or_lines": [
    "src/example.ts:42"
  ],
  "commands": [
    "npm run build"
  ],
  "stack_trace": [],
  "likely_causes": [
    "The Result type and the value consumed at src/example.ts:42 are out of sync."
  ],
  "next_things_to_check": [
    "Inspect the Result type definition.",
    "Inspect the expression at src/example.ts:42.",
    "Search for recent changes to the status field or Result interface."
  ],
  "search_keywords": [
    "interface Result",
    "type Result",
    ".status"
  ],
  "uncertain_points": [
    "The screenshot alone cannot establish which source change introduced the mismatch."
  ],
  "confidence": 0.94
}
```

The exact wording and values depend on the configured vision model and the screenshot.

## 3. Let the coding agent inspect the repository

The important handoff is not "vision model writes the fix." The vision model provides evidence; the coding agent then uses repository context to reason about the fix.

For example:

```text
Use ocular to inspect build-error.png first.
Preserve exact visible error text as evidence.
Then search the repository for the referenced file, line, symbol, and type.
Explain the smallest likely fix and run the relevant checks.
```

The resulting workflow is:

```text
Screenshot
   |
   v
ocular vision tool
   |
   v
structured visual evidence
   |
   v
coding agent + repository context
   |
   v
source-level diagnosis / fix / verification
```

## UI review works the same way

For frontend work, call `analyze_ui_screenshot` with optional `framework_hint` and `page_hint` fields:

```json
{
  "file_id": "e21ba723...",
  "task": "Identify implementation-relevant visual defects and accessibility concerns.",
  "framework_hint": "React + Tailwind",
  "page_hint": "Settings page"
}
```

That tool is designed to return structured fields for visible text, UI elements, layout, visual details, issues, implementation hints, uncertainty, and confidence.

## Why the binary side channel matters

For local stdio use, inline `image_base64` is available. For remote deployments, `file_id` is the preferred path for large images:

```text
raw image bytes -> PUT /upload -> file_id -> MCP tool call
```

This keeps large binary payloads out of the normal MCP JSON argument path, while uploaded content is deduplicated and can persist across calls and process restarts.

See also:

- [Architecture](architecture.md)
- [Deployment](deployment.md)
- [Claude Code example](../examples/claude-code.md)
- [Screenshot debugging workflow](../examples/screenshot-debugging.md)

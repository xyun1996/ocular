# Screenshot debugging workflow

This example shows how `ocular` can turn a visual bug report into evidence a coding agent can act on.

## Scenario

A user reports that a page is broken and attaches only a screenshot. The screenshot may contain:

- a browser error overlay
- terminal output
- an unexpected layout
- truncated text
- a failed network/error dialog

Instead of manually transcribing the screenshot, the coding agent can ask `ocular` for structured observations.

## 1. Upload the screenshot

For a remote HTTP deployment:

```bash
curl --request PUT \
  --data-binary @./bug.png \
  "https://your.host/upload" \
  -H "Content-Type: image/png" \
  -H "Authorization: Bearer your_mcp_auth_token"
```

Example response:

```json
{
  "ok": true,
  "file_id": "e21ba723...",
  "bytes": 8291,
  "mime_type": "image/png",
  "dedup": false
}
```

## 2. Extract exact error evidence

Use `diagnose_error_screenshot` when the image contains terminal, browser-console, build, or runtime errors:

```json
{
  "file_id": "e21ba723...",
  "task": "Extract the exact error text, file and line references, commands, and stack trace. Then rank the most likely causes.",
  "project_context": "Node.js TypeScript application"
}
```

A coding agent can use the returned structured fields to search the repository for matching symbols, files, or error strings.

## 3. Inspect visual implementation problems

For a UI bug, use `analyze_ui_screenshot`:

```json
{
  "file_id": "e21ba723...",
  "task": "Identify visible implementation defects and give concrete layout/CSS clues.",
  "framework_hint": "React + Tailwind",
  "page_hint": "Settings page"
}
```

Useful areas to ask about include:

- component hierarchy
- alignment and overflow
- spacing consistency
- typography
- color and contrast
- responsive behavior visible in the screenshot
- likely CSS/layout primitives involved

## 4. Compare against a reference

If you have both a design/reference screenshot and the current implementation, upload both and call `compare_ui_screenshots`:

```json
{
  "images": [
    { "file_id": "reference-file-id" },
    { "file_id": "implementation-file-id" }
  ],
  "task": "Find visual regressions and rank them by user impact.",
  "framework_hint": "React + Tailwind"
}
```

## 5. Let the coding agent continue from evidence

A useful agent prompt is:

```text
Use ocular to analyze the attached screenshot first. Treat exact visible text as evidence. Then inspect the repository for the relevant source code, propose the smallest fix, and explain how you would verify it.
```

The goal is not to make the vision model write the code. The goal is to give the coding agent reliable visual context so it can combine that evidence with repository-level reasoning.

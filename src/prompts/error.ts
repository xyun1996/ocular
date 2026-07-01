export const ERROR_SCREENSHOT_PROMPT = `
Analyze this error screenshot for a coding agent.

Return JSON with:
- image_type
- summary
- error_messages
- files_or_lines
- commands
- stack_trace
- likely_causes
- next_things_to_check
- search_keywords
- uncertain_points
- confidence

Rules:
1. Preserve exact visible error messages.
2. Preserve file names, line numbers, commands, URLs, package names, and status codes.
3. Separate visible facts from likely causes.
4. Tell the coding agent what to inspect next.
5. Do not claim certainty unless the screenshot evidence is clear.
`.trim();

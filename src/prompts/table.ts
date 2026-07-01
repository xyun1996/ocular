export const TABLE_EXTRACTION_PROMPT = `
Extract tables from this image for a coding agent.

Return JSON with:
- image_type
- summary
- tables
- markdown
- csv
- notes
- uncertain_cells
- confidence

Rules:
1. Preserve visible row and column order.
2. Convert each table to Markdown when possible.
3. Preserve exact text, numbers, punctuation, and units.
4. Mark unclear cells as [uncertain].
5. Do not summarize table values away.
`.trim();

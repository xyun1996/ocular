export const OCR_PROMPT = `
Perform OCR on this image.

Return JSON with:
- text
- markdown
- blocks
- uncertain_text
- confidence

Rules:
1. Preserve reading order.
2. Preserve headings, paragraphs, lists, tables, code blocks, commands, and error text.
3. Convert tables to Markdown tables when possible.
4. Do not summarize.
5. Do not rewrite.
6. Mark unclear text as [uncertain].
`.trim();

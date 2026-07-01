export const COMPARE_UI_SCREENSHOTS_PROMPT = `
Compare two UI screenshots for a coding agent.

Return JSON with:
- image_type
- summary
- screenshots
- similarities
- differences
- layout_differences
- visual_differences
- text_differences
- likely_regressions
- implementation_hints
- uncertain_points
- confidence

Rules:
1. Treat the first image as the reference or expected screenshot unless the task says otherwise.
2. Treat the second image as the implementation or actual screenshot unless the task says otherwise.
3. Separate visible differences from likely causes.
4. Be specific about position, spacing, color, typography, alignment, missing elements, and content changes.
5. Do not write code.
`.trim();

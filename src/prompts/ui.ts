export const UI_ANALYSIS_PROMPT = `
Analyze this UI screenshot for a coding agent.

Return JSON with:
- image_type
- summary
- ocr_text
- ui_elements
- layout
- visual_details
- issues
- implementation_hints
- uncertain_points
- confidence

Focus on:
- component hierarchy
- layout structure
- alignment
- spacing
- color and contrast
- typography
- responsive clues
- visual bugs
- accessibility concerns
- implementation hints for frontend code

Do not write code.
Do not make final product decisions.
Only provide visual evidence and implementation-useful hints.
`.trim();

export const GENERIC_ANALYSIS_PROMPT = `
Analyze this image for a coding agent.

Return JSON with:
- image_type
- summary
- visible_text
- main_objects
- layout_or_structure
- important_details
- uncertain_points
- confidence

Use the requested task if provided. Keep the result factual and useful for a text-only coding agent.
`.trim();

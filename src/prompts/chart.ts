export const CHART_ANALYSIS_PROMPT = `
Analyze this chart image for a coding agent.

Return JSON with:
- image_type
- summary
- chart_type
- title
- axes
- legend
- series
- visible_values
- trends
- anomalies
- data_limitations
- uncertain_points
- confidence

Rules:
1. Describe only visible chart information.
2. Preserve labels, units, categories, and approximate values when visible.
3. Distinguish exact OCR text from estimated visual readings.
4. Do not invent source data that is not visible.
`.trim();

export function parseVisionJson(text: string): unknown {
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) {
      try {
        return JSON.parse(fenced[1].trim());
      } catch {
        // Continue to object extraction.
      }
    }

    const objectText = extractFirstJsonObject(trimmed);
    if (objectText) {
      try {
        return JSON.parse(objectText);
      } catch (error) {
        return fallback(text, error);
      }
    }

    return fallback(text, new Error("No JSON object found"));
  }
}

function fallback(rawText: string, error: unknown): Record<string, unknown> {
  return {
    raw_text: rawText,
    parse_error: error instanceof Error ? error.message : String(error),
    warning: "Vision model did not return valid JSON."
  };
}

function extractFirstJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") inString = true;
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;

    if (depth === 0) return text.slice(start, index + 1);
  }

  return null;
}

import { z } from "zod";
import type { VisionBridgeConfig } from "../config.js";
import { COMMON_SYSTEM_PROMPT } from "../prompts/common.js";
import { OCR_PROMPT } from "../prompts/ocr.js";
import type { VisionProvider } from "../providers/types.js";
import { base64ImageSchema, imageInputFromArgs } from "./image-input.js";
import { runVisionTool } from "./tool-runner.js";

export const extractTextSchema = {
  ...base64ImageSchema,
  preserve_layout: z.boolean().default(true),
  language_hint: z.string().optional(),
  output_format: z.enum(["markdown", "json", "plain_text"]).default("json")
};

export async function extractTextFromImage(
  args: z.objectOutputType<typeof extractTextSchema, z.ZodTypeAny>,
  config: VisionBridgeConfig,
  provider: VisionProvider
) {
  const userPrompt = `${OCR_PROMPT}

Preserve layout: ${args.preserve_layout}
Language hint: ${args.language_hint ?? "none"}
Requested output format: ${args.output_format}
Return valid JSON with the requested fields.`;

  return runVisionTool({
    toolName: "extract_text_from_image",
    ...(await imageInputFromArgs(args)),
    systemPrompt: COMMON_SYSTEM_PROMPT,
    userPrompt,
    task: "ocr",
    options: {
      preserve_layout: args.preserve_layout,
      language_hint: args.language_hint ?? "",
      output_format: args.output_format
    },
    config,
    provider
  });
}

import { z } from "zod";
import type { VisionBridgeConfig } from "../config.js";
import { COMMON_SYSTEM_PROMPT } from "../prompts/common.js";
import { TABLE_EXTRACTION_PROMPT } from "../prompts/table.js";
import type { VisionProvider } from "../providers/types.js";
import { base64ImageSchema, imageInputFromArgs } from "./image-input.js";
import { runVisionTool } from "./tool-runner.js";

export const extractTableSchema = {
  ...base64ImageSchema,
  task: z.string().optional(),
  output_format: z.enum(["json", "markdown", "csv"]).default("json")
};

export async function extractTableFromImage(
  args: z.objectOutputType<typeof extractTableSchema, z.ZodTypeAny>,
  config: VisionBridgeConfig,
  provider: VisionProvider
) {
  const task = args.task?.trim() || "Extract visible table data from the image.";
  const userPrompt = `${TABLE_EXTRACTION_PROMPT}

Task: ${task}
Requested output format: ${args.output_format}
Return valid JSON with the requested fields.`;

  return runVisionTool({
    toolName: "extract_table_from_image",
    ...imageInputFromArgs(args),
    systemPrompt: COMMON_SYSTEM_PROMPT,
    userPrompt,
    task,
    options: { output_format: args.output_format },
    config,
    provider
  });
}

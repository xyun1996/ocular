import { z } from "zod";
import type { VisionBridgeConfig } from "../config.js";
import { COMMON_SYSTEM_PROMPT } from "../prompts/common.js";
import { GENERIC_ANALYSIS_PROMPT } from "../prompts/generic.js";
import type { VisionProvider } from "../providers/types.js";
import { base64ImageSchema, imageInputFromArgs } from "./image-input.js";
import { runVisionTool } from "./tool-runner.js";

export const analyzeImageSchema = {
  ...base64ImageSchema,
  task: z.string().optional().describe("Optional analysis task."),
  output_format: z.enum(["json", "markdown", "text"]).default("json")
};

export async function analyzeImage(
  args: z.objectOutputType<typeof analyzeImageSchema, z.ZodTypeAny>,
  config: VisionBridgeConfig,
  provider: VisionProvider
) {
  const task = args.task?.trim() || "Perform a general image analysis.";
  const userPrompt = `${GENERIC_ANALYSIS_PROMPT}

Task: ${task}
Requested output format: ${args.output_format}
Return valid JSON unless the requested format explicitly requires otherwise.`;

  return runVisionTool({
    toolName: "analyze_image",
    ...(await imageInputFromArgs(args)),
    systemPrompt: COMMON_SYSTEM_PROMPT,
    userPrompt,
    task,
    options: { output_format: args.output_format },
    config,
    provider
  });
}

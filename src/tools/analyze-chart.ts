import { z } from "zod";
import type { VisionBridgeConfig } from "../config.js";
import { CHART_ANALYSIS_PROMPT } from "../prompts/chart.js";
import { COMMON_SYSTEM_PROMPT } from "../prompts/common.js";
import type { VisionProvider } from "../providers/types.js";
import { base64ImageSchema, imageInputFromArgs } from "./image-input.js";
import { runVisionTool } from "./tool-runner.js";

export const analyzeChartSchema = {
  ...base64ImageSchema,
  task: z.string().optional(),
  chart_hint: z.string().optional()
};

export async function analyzeChartImage(
  args: z.objectOutputType<typeof analyzeChartSchema, z.ZodTypeAny>,
  config: VisionBridgeConfig,
  provider: VisionProvider
) {
  const task = args.task?.trim() || "Analyze the visible chart.";
  const userPrompt = `${CHART_ANALYSIS_PROMPT}

Task: ${task}
Chart hint: ${args.chart_hint ?? "none"}
Return valid JSON with the requested fields.`;

  return runVisionTool({
    toolName: "analyze_chart_image",
    ...imageInputFromArgs(args),
    systemPrompt: COMMON_SYSTEM_PROMPT,
    userPrompt,
    task,
    options: { chart_hint: args.chart_hint ?? "" },
    config,
    provider
  });
}

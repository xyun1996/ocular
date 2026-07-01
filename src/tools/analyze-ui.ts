import { z } from "zod";
import type { VisionBridgeConfig } from "../config.js";
import { COMMON_SYSTEM_PROMPT } from "../prompts/common.js";
import { UI_ANALYSIS_PROMPT } from "../prompts/ui.js";
import type { VisionProvider } from "../providers/types.js";
import { base64ImageSchema, imageInputFromArgs } from "./image-input.js";
import { runVisionTool } from "./tool-runner.js";

export const analyzeUiSchema = {
  ...base64ImageSchema,
  task: z.string().optional(),
  framework_hint: z.string().optional(),
  page_hint: z.string().optional()
};

export async function analyzeUiScreenshot(
  args: z.objectOutputType<typeof analyzeUiSchema, z.ZodTypeAny>,
  config: VisionBridgeConfig,
  provider: VisionProvider
) {
  const task = args.task?.trim() || "Analyze the UI screenshot and return implementation-useful visual observations.";
  const userPrompt = `${UI_ANALYSIS_PROMPT}

Task: ${task}
Framework hint: ${args.framework_hint ?? "none"}
Page hint: ${args.page_hint ?? "none"}
Return valid JSON with the requested fields.`;

  return runVisionTool({
    toolName: "analyze_ui_screenshot",
    ...(await imageInputFromArgs(args)),
    systemPrompt: COMMON_SYSTEM_PROMPT,
    userPrompt,
    task,
    options: {
      framework_hint: args.framework_hint ?? "",
      page_hint: args.page_hint ?? ""
    },
    config,
    provider
  });
}

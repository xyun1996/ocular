import { z } from "zod";
import type { VisionBridgeConfig } from "../config.js";
import { COMMON_SYSTEM_PROMPT } from "../prompts/common.js";
import { ERROR_SCREENSHOT_PROMPT } from "../prompts/error.js";
import type { VisionProvider } from "../providers/types.js";
import { base64ImageSchema, imageInputFromArgs } from "./image-input.js";
import { runVisionTool } from "./tool-runner.js";

export const diagnoseErrorSchema = {
  ...base64ImageSchema,
  task: z.string().optional(),
  project_context: z.string().optional()
};

export async function diagnoseErrorScreenshot(
  args: z.objectOutputType<typeof diagnoseErrorSchema, z.ZodTypeAny>,
  config: VisionBridgeConfig,
  provider: VisionProvider
) {
  const task = args.task?.trim() || "Diagnose the visible error screenshot for a coding agent.";
  const userPrompt = `${ERROR_SCREENSHOT_PROMPT}

Task: ${task}
Project context: ${args.project_context ?? "none"}
Return valid JSON with the requested fields.`;

  return runVisionTool({
    toolName: "diagnose_error_screenshot",
    ...imageInputFromArgs(args),
    systemPrompt: COMMON_SYSTEM_PROMPT,
    userPrompt,
    task,
    options: {
      project_context: args.project_context ?? ""
    },
    config,
    provider
  });
}

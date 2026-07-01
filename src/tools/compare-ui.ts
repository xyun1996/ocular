import { z } from "zod";
import type { OcularConfig } from "../config.js";
import { COMMON_SYSTEM_PROMPT } from "../prompts/common.js";
import { COMPARE_UI_SCREENSHOTS_PROMPT } from "../prompts/compare-ui.js";
import type { VisionProvider } from "../providers/types.js";
import { imageInputsFromArgs, imageItemSchema } from "./image-input.js";
import { runVisionTool } from "./tool-runner.js";

export const compareUiSchema = {
  images: z
    .array(imageItemSchema)
    .length(2)
    .describe("Two base64 UI screenshots. First is reference, second is actual."),
  task: z.string().optional(),
  framework_hint: z.string().optional(),
  page_hint: z.string().optional()
};

export async function compareUiScreenshots(
  args: z.objectOutputType<typeof compareUiSchema, z.ZodTypeAny>,
  config: OcularConfig,
  provider: VisionProvider
) {
  const task = args.task?.trim() || "Compare the reference UI screenshot against the actual UI screenshot.";
  const userPrompt = `${COMPARE_UI_SCREENSHOTS_PROMPT}

Task: ${task}
Framework hint: ${args.framework_hint ?? "none"}
Page hint: ${args.page_hint ?? "none"}
Return valid JSON with the requested fields.`;

  return runVisionTool({
    toolName: "compare_ui_screenshots",
    ...(await imageInputsFromArgs(args)),
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

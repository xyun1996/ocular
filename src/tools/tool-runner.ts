import type { OcularConfig } from "../config.js";
import { PROMPT_VERSION } from "../prompts/common.js";
import type { VisionProvider } from "../providers/types.js";
import { VisionCache } from "../utils/cache.js";
import { toErrorResult } from "../utils/errors.js";
import { hashImageDataUrl, validateImageDataUrl } from "../utils/image.js";
import { parseVisionJson } from "./json.js";

export interface RunVisionToolInput {
  toolName: string;
  imageDataUrl?: string;
  imageDataUrls?: string[];
  systemPrompt: string;
  userPrompt: string;
  task?: string;
  options: Record<string, unknown>;
  config: OcularConfig;
  provider: VisionProvider;
}

export async function runVisionTool(input: RunVisionToolInput): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const tStart = performance.now();
  try {
    const imageDataUrls = getImageDataUrls(input);
    await Promise.all(
      imageDataUrls.map((imageDataUrl) => validateImageDataUrl(imageDataUrl, { maxImageMb: input.config.maxImageMb }))
    );
    const tValidate = performance.now();

    const cache = new VisionCache({
      enabled: input.config.cacheEnabled,
      cacheDir: input.config.cacheDir
    });
    const cacheKey = await cache.createKey({
      imageDataUrls,
      tool: input.toolName,
      task: input.task,
      model: input.config.model,
      promptVersion: PROMPT_VERSION,
      options: input.options
    });
    const tCacheKey = performance.now();

    const cached = await cache.read(cacheKey);
    const tCacheRead = performance.now();
    if (cached) {
      console.error(`[ocular] tool=${input.toolName} total=cache_hit ${(tCacheRead - tStart).toFixed(1)}ms validate=${(tValidate - tStart).toFixed(1)}ms cacheKey=${(tCacheKey - tValidate).toFixed(1)}ms cacheRead=${(tCacheRead - tCacheKey).toFixed(1)}ms`);
      return asMcpText(cached.result);
    }

    const output = await input.provider.analyze({
      imageDataUrl: input.imageDataUrl,
      imageDataUrls: input.imageDataUrls,
      systemPrompt: input.systemPrompt,
      userPrompt: input.userPrompt,
      temperature: input.config.temperature,
      maxTokens: input.config.maxTokens
    });
    const tProvider = performance.now();

    const result = parseVisionJson(output.text);
    const tParse = performance.now();

    const inputHash = hashImageSet(imageDataUrls);

    await cache.write(cacheKey, {
      provider: input.config.provider,
      model: input.config.model,
      tool: input.toolName,
      inputHash,
      result
    });
    const tCacheWrite = performance.now();

    console.error(`[ocular] tool=${input.toolName} total=${(tCacheWrite - tStart).toFixed(1)}ms validate=${(tValidate - tStart).toFixed(1)}ms cacheKey=${(tCacheKey - tValidate).toFixed(1)}ms cacheRead=${(tCacheRead - tCacheKey).toFixed(1)}ms provider=${(tProvider - tCacheRead).toFixed(1)}ms parseJson=${(tParse - tProvider).toFixed(1)}ms cacheWrite=${(tCacheWrite - tParse).toFixed(1)}ms`);

    return asMcpText(result);
  } catch (error) {
    const tErr = performance.now();
    console.error(`[ocular] tool=${input.toolName} ERROR total=${(tErr - tStart).toFixed(1)}ms`);
    return asMcpText(toErrorResult(error));
  }
}

export function asMcpText(result: unknown): { content: Array<{ type: "text"; text: string }> } {
  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
  };
}

function getImageDataUrls(input: RunVisionToolInput): string[] {
  if (input.imageDataUrls?.length) return input.imageDataUrls;
  if (input.imageDataUrl) return [input.imageDataUrl];
  throw new Error("image_base64 is required");
}

function hashImageSet(imageDataUrls: string[]): string {
  const hashes = imageDataUrls.map((imageDataUrl) => hashImageDataUrl(imageDataUrl));
  return hashes.join(":");
}

import type { VisionBridgeConfig } from "../config.js";
import { OpenAICompatibleVisionProvider } from "./openai-compatible.js";
import type { VisionProvider } from "./types.js";

export function createVisionProvider(config: VisionBridgeConfig): VisionProvider {
  return new OpenAICompatibleVisionProvider({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    model: config.model,
    headers: config.headers,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    timeoutMs: config.timeoutMs
  });
}

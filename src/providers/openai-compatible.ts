import { OcularError } from "../utils/errors.js";
import type { VisionAnalyzeInput, VisionAnalyzeOutput, VisionProvider } from "./types.js";

export interface OpenAICompatibleConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  headers: Record<string, string>;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export class OpenAICompatibleVisionProvider implements VisionProvider {
  constructor(
    private readonly config: OpenAICompatibleConfig,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async analyze(input: VisionAnalyzeInput): Promise<VisionAnalyzeOutput> {
    const tStart = performance.now();
    const { url, init } = await this.buildRequest(input);
    const tBuildRequest = performance.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await this.fetchImpl(url, { ...init, signal: controller.signal });
      const tFetchDone = performance.now();
      const rawText = await response.text();
      const tReadBody = performance.now();

      if (!response.ok) {
        throw new OcularError(
          "OCULAR_PROVIDER_REQUEST_FAILED",
          `Vision provider request failed with status ${response.status}: ${rawText.slice(0, 500)}`
        );
      }

      let data: ChatCompletionResponse;
      try {
        data = JSON.parse(rawText) as ChatCompletionResponse;
      } catch (error) {
        throw new OcularError("OCULAR_PROVIDER_INVALID_RESPONSE", "Vision provider returned invalid response", error);
      }

      const text = data.choices?.[0]?.message?.content;
      if (typeof text !== "string") {
        throw new OcularError("OCULAR_PROVIDER_INVALID_RESPONSE", "Vision provider returned invalid response");
      }

      const tEnd = performance.now();
      console.error(`[ocular] provider.analyze total=${(tEnd - tStart).toFixed(1)}ms buildRequest=${(tBuildRequest - tStart).toFixed(1)}ms fetch=${(tFetchDone - tBuildRequest).toFixed(1)}ms readBody=${(tReadBody - tFetchDone).toFixed(1)}ms parse=${(tEnd - tReadBody).toFixed(1)}ms model=${this.config.model} promptTokens=${data.usage?.prompt_tokens ?? "?"} completionTokens=${data.usage?.completion_tokens ?? "?"}`);

      return {
        text,
        raw: data,
        usage: {
          promptTokens: data.usage?.prompt_tokens,
          completionTokens: data.usage?.completion_tokens,
          totalTokens: data.usage?.total_tokens
        }
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async buildRequest(input: VisionAnalyzeInput): Promise<{ url: string; init: RequestInit }> {
    if (!input.imageDataUrl && !input.imageDataUrls?.length) {
      throw new OcularError("IMAGE_INPUT_MISSING", "image_base64 is required");
    }

    const imageUrls = await this.resolveImageUrls(input);
    const baseUrl = this.config.baseUrl.replace(/\/+$/, "");
    const url = baseUrl.endsWith("/chat/completions") ? baseUrl : `${baseUrl}/chat/completions`;

    return {
      url,
      init: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
          ...this.config.headers
        },
        body: JSON.stringify({
          model: this.config.model,
          temperature: input.temperature ?? this.config.temperature,
          max_tokens: input.maxTokens ?? this.config.maxTokens,
          messages: [
            { role: "system", content: input.systemPrompt },
            {
              role: "user",
              content: [
                { type: "text", text: input.userPrompt },
                ...imageUrls.map((imageUrl) => ({
                  type: "image_url",
                  image_url: {
                    url: imageUrl,
                    detail: "high"
                  }
                }))
              ]
            }
          ]
        })
      }
    };
  }

  private async resolveImageUrls(input: VisionAnalyzeInput): Promise<string[]> {
    if (input.imageDataUrls?.length) {
      return input.imageDataUrls;
    }

    if (input.imageDataUrl) {
      return [input.imageDataUrl];
    }

    throw new OcularError("IMAGE_INPUT_MISSING", "image_base64 is required");
  }
}

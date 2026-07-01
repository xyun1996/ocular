export interface VisionAnalyzeInput {
  imageDataUrl?: string;
  imageDataUrls?: string[];
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
}

export interface VisionAnalyzeOutput {
  text: string;
  raw?: unknown;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export interface VisionProvider {
  analyze(input: VisionAnalyzeInput): Promise<VisionAnalyzeOutput>;
}

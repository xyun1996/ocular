import "dotenv/config";
import { VisionBridgeError } from "./utils/errors.js";

export interface VisionBridgeConfig {
  transport: "stdio" | "http";
  httpHost: string;
  httpPort: number;
  httpPath: string;
  authToken?: string;
  authHeader: string;
  authScheme: string;
  provider: "openai-compatible";
  baseUrl: string;
  apiKey: string;
  model: string;
  headers: Record<string, string>;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  maxImageMb: number;
  cacheEnabled: boolean;
  cacheDir: string;
  uploadsDir: string;
  publicUploadUrl: string;
}

function readNumber(name: string, defaultValue: number): number {
  const raw = process.env[name];
  if (!raw) return defaultValue;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new VisionBridgeError("INVALID_CONFIG", `${name} must be a number`);
  }
  return parsed;
}

function readBoolean(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (!raw) return defaultValue;
  return raw.toLowerCase() === "true";
}

function readHeaders(): Record<string, string> {
  const raw = process.env.VISION_HEADERS ?? "{}";
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("headers must be an object");
    }
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).map(([key, value]) => [key, String(value)])
    );
  } catch (error) {
    throw new VisionBridgeError("INVALID_CONFIG", "VISION_HEADERS must be a JSON object string", error);
  }
}

export function loadConfig(): VisionBridgeConfig {
  const transport = readTransport();
  const provider = process.env.VISION_PROVIDER ?? "openai-compatible";
  if (provider !== "openai-compatible") {
    throw new VisionBridgeError("UNSUPPORTED_PROVIDER", `Unsupported provider: ${provider}`);
  }

  const baseUrl = process.env.VISION_BASE_URL;
  const apiKey = process.env.VISION_API_KEY;
  const model = process.env.VISION_MODEL;

  if (!baseUrl) throw new VisionBridgeError("VISION_BASE_URL_MISSING", "VISION_BASE_URL is missing");
  if (!apiKey) throw new VisionBridgeError("VISION_API_KEY_MISSING", "VISION_API_KEY is missing");
  if (!model) throw new VisionBridgeError("VISION_MODEL_MISSING", "VISION_MODEL is missing");

  const authToken = process.env.MCP_AUTH_TOKEN;
  if (transport === "http" && !authToken) {
    throw new VisionBridgeError("MCP_AUTH_TOKEN_MISSING", "MCP_AUTH_TOKEN is required when MCP_TRANSPORT=http");
  }

  return {
    transport,
    httpHost: process.env.MCP_HTTP_HOST ?? "127.0.0.1",
    httpPort: readNumber("MCP_HTTP_PORT", 3000),
    httpPath: process.env.MCP_HTTP_PATH ?? "/mcp",
    authToken,
    authHeader: (process.env.MCP_AUTH_HEADER ?? "authorization").toLowerCase(),
    authScheme: process.env.MCP_AUTH_SCHEME ?? "Bearer",
    provider,
    baseUrl,
    apiKey,
    model,
    headers: readHeaders(),
    temperature: readNumber("VISION_TEMPERATURE", 0.1),
    maxTokens: readNumber("VISION_MAX_TOKENS", 4096),
    timeoutMs: readNumber("VISION_TIMEOUT_MS", 60_000),
    maxImageMb: readNumber("VISION_MAX_IMAGE_MB", 10),
    cacheEnabled: readBoolean("VISION_CACHE_ENABLED", true),
    cacheDir: process.env.VISION_CACHE_DIR ?? ".vision-cache",
    uploadsDir: process.env.VISION_UPLOADS_DIR ?? ".vision-uploads",
    publicUploadUrl: (process.env.VISION_UPLOAD_URL_BASE ?? `http://${process.env.MCP_HTTP_HOST ?? "127.0.0.1"}:${process.env.MCP_HTTP_PORT ?? "3000"}`).replace(/\/+$/, "") + "/upload"
  };
}

function readTransport(): "stdio" | "http" {
  const raw = process.env.MCP_TRANSPORT ?? "stdio";
  if (raw === "stdio" || raw === "http") return raw;
  throw new VisionBridgeError("INVALID_CONFIG", "MCP_TRANSPORT must be stdio or http");
}

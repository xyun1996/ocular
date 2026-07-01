import "dotenv/config";
import { OcularError } from "./utils/errors.js";

export interface OcularConfig {
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
    throw new OcularError("INVALID_CONFIG", `${name} must be a number`);
  }
  return parsed;
}

function readBoolean(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (!raw) return defaultValue;
  return raw.toLowerCase() === "true";
}

function readHeaders(): Record<string, string> {
  const raw = process.env.OCULAR_HEADERS ?? "{}";
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("headers must be an object");
    }
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).map(([key, value]) => [key, String(value)])
    );
  } catch (error) {
    throw new OcularError("INVALID_CONFIG", "OCULAR_HEADERS must be a JSON object string", error);
  }
}

export function loadConfig(): OcularConfig {
  const transport = readTransport();
  const provider = process.env.OCULAR_PROVIDER ?? "openai-compatible";
  if (provider !== "openai-compatible") {
    throw new OcularError("UNSUPPORTED_PROVIDER", `Unsupported provider: ${provider}`);
  }

  const baseUrl = process.env.OCULAR_BASE_URL;
  const apiKey = process.env.OCULAR_API_KEY;
  const model = process.env.OCULAR_MODEL;

  if (!baseUrl) throw new OcularError("OCULAR_BASE_URL_MISSING", "OCULAR_BASE_URL is missing");
  if (!apiKey) throw new OcularError("OCULAR_API_KEY_MISSING", "OCULAR_API_KEY is missing");
  if (!model) throw new OcularError("OCULAR_MODEL_MISSING", "OCULAR_MODEL is missing");

  const authToken = process.env.MCP_AUTH_TOKEN;
  if (transport === "http" && !authToken) {
    throw new OcularError("MCP_AUTH_TOKEN_MISSING", "MCP_AUTH_TOKEN is required when MCP_TRANSPORT=http");
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
    temperature: readNumber("OCULAR_TEMPERATURE", 0.1),
    maxTokens: readNumber("OCULAR_MAX_TOKENS", 4096),
    timeoutMs: readNumber("OCULAR_TIMEOUT_MS", 60_000),
    maxImageMb: readNumber("OCULAR_MAX_IMAGE_MB", 10),
    cacheEnabled: readBoolean("OCULAR_CACHE_ENABLED", true),
    cacheDir: process.env.OCULAR_CACHE_DIR ?? ".ocular-cache",
    uploadsDir: process.env.OCULAR_UPLOADS_DIR ?? ".ocular-uploads",
    publicUploadUrl: (process.env.OCULAR_UPLOAD_URL_BASE ?? `http://${process.env.MCP_HTTP_HOST ?? "127.0.0.1"}:${process.env.MCP_HTTP_PORT ?? "3000"}`).replace(/\/+$/, "") + "/upload"
  };
}

function readTransport(): "stdio" | "http" {
  const raw = process.env.MCP_TRANSPORT ?? "stdio";
  if (raw === "stdio" || raw === "http") return raw;
  throw new OcularError("INVALID_CONFIG", "MCP_TRANSPORT must be stdio or http");
}

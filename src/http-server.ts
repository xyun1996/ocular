import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express, { type NextFunction, type Request, type Response } from "express";
import type { OcularConfig } from "./config.js";
import { authorizeHeaders, createUnauthorizedResponse } from "./auth.js";
import { createMcpServer } from "./mcp-server.js";
import type { VisionProvider } from "./providers/types.js";
import { logger } from "./utils/logger.js";
import { UPLOAD_PATH, initUploadStore, getUploadStore } from "./utils/upload-store-instance.js";
import { assertValidImageBytes } from "./utils/image.js";

const SUPPORTED_IMAGE_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export async function startHttpServer(config: OcularConfig, provider: VisionProvider): Promise<void> {
  if (!config.authToken) {
    throw new Error("MCP_AUTH_TOKEN is required when MCP_TRANSPORT=http");
  }

  await initUploadStore(config).init();
  logger.info(`ocular upload store at ${config.uploadsDir}`);

  const app = express();
  app.use(express.json({ limit: "20mb" }));
  app.use(config.httpPath, authMiddleware(config));

  // Binary upload side-channel: PUT /upload with raw image bytes.
  // Server computes sha256 -> file_id (content-addressed, deduplicated).
  // Keeps large image data out of the JSON MCP tool-call path.
  app.put(
    UPLOAD_PATH,
    authMiddleware(config),
    express.raw({ type: "*/*", limit: `${config.maxImageMb * 2}mb` }),
    async (req: Request, res: Response) => {
      const body = req.body as Buffer | undefined;
      if (!Buffer.isBuffer(body) || body.length === 0) {
        res.status(400).json({ error: "Request body must be raw binary image bytes (use curl --data-binary)." });
        return;
      }

      const mimeType = (req.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
      if (!SUPPORTED_IMAGE_MIME.has(mimeType)) {
        res.status(400).json({ error: `Unsupported Content-Type: ${mimeType}. Expected one of: ${[...SUPPORTED_IMAGE_MIME].join(", ")}` });
        return;
      }

      const maxBytes = config.maxImageMb * 1024 * 1024;
      if (body.length > maxBytes) {
        res.status(413).json({ error: `Image too large: ${body.length} bytes. Max ${config.maxImageMb} MB.` });
        return;
      }

      // Validate image signature (magic bytes) matches declared Content-Type.
      // Catches empty bodies, non-image uploads, and curl sending an error page.
      try {
        assertValidImageBytes(body, mimeType);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`[ocular] upload.reject mime=${mimeType} bytes=${body.length} reason=${msg.slice(0, 80)}`);
        res.status(400).json({ error: msg });
        return;
      }

      const originalName = typeof req.headers["x-filename"] === "string" ? req.headers["x-filename"] : undefined;
      try {
        const tStart = performance.now();
        const { meta, dedup } = await getUploadStore().stage(body, mimeType, originalName);
        const tEnd = performance.now();
        console.error(`[ocular] upload.stage file_id=${meta.file_id} bytes=${meta.size} mime=${mimeType} dedup=${dedup ? "hit" : "miss"} stageMs=${(tEnd - tStart).toFixed(1)}`);
        res.status(200).json({ ok: true, file_id: meta.file_id, bytes: meta.size, mime_type: meta.mime_type, dedup });
      } catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
      }
    }
  );

  app.post(config.httpPath, async (req: Request, res: Response) => {
    const tReqStart = performance.now();
    const reqMethod = (req.body as { method?: string } | null)?.method ?? "?";
    const reqId = (req.body as { id?: string | number } | null)?.id ?? "?";
    console.error(`[ocular] http.req method=${reqMethod} id=${reqId} bodyBytes=${JSON.stringify(req.body ?? {}).length}`);

    const server = createMcpServer(config, provider);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true
    });

    try {
      await server.connect(transport);
      const tConnected = performance.now();
      await transport.handleRequest(req, res, req.body);
      const tHandled = performance.now();
      console.error(`[ocular] http.resp method=${reqMethod} id=${reqId} total=${(tHandled - tReqStart).toFixed(1)}ms connect=${(tConnected - tReqStart).toFixed(1)}ms handle=${(tHandled - tConnected).toFixed(1)}ms status=${res.statusCode}`);
      res.on("close", () => {
        void transport.close();
        void server.close();
      });
    } catch (error) {
      logger.error("Error handling MCP HTTP request", {
        message: error instanceof Error ? error.message : String(error)
      });

      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Internal server error"
          },
          id: null
        });
      }
    }
  });

  app.get(config.httpPath, (_req: Request, res: Response) => {
    res.status(405).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed." },
      id: null
    });
  });

  app.delete(config.httpPath, (_req: Request, res: Response) => {
    res.status(405).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed." },
      id: null
    });
  });

  await new Promise<void>((resolve, reject) => {
    const server = app.listen(config.httpPort, config.httpHost, () => {
      logger.info(`ocular HTTP listening on ${config.httpHost}:${config.httpPort}${config.httpPath}`);
      resolve();
    });
    server.on("error", reject);
  });
}

function authMiddleware(config: OcularConfig) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (Array.isArray(value)) {
        headers.set(key, value.join(","));
      } else if (value !== undefined) {
        headers.set(key, value);
      }
    }

    const authorized = authorizeHeaders(headers, {
      token: config.authToken ?? "",
      headerName: config.authHeader,
      scheme: config.authScheme
    });

    if (!authorized) {
      res.status(401).json(createUnauthorizedResponse());
      return;
    }

    next();
  };
}

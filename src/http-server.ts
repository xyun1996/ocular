import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express, { type NextFunction, type Request, type Response } from "express";
import type { VisionBridgeConfig } from "./config.js";
import { authorizeHeaders, createUnauthorizedResponse } from "./auth.js";
import { createMcpServer } from "./mcp-server.js";
import type { VisionProvider } from "./providers/types.js";
import { logger } from "./utils/logger.js";
import { UPLOAD_PATH, uploadStore } from "./utils/upload-store-instance.js";

const SUPPORTED_IMAGE_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export async function startHttpServer(config: VisionBridgeConfig, provider: VisionProvider): Promise<void> {
  if (!config.authToken) {
    throw new Error("MCP_AUTH_TOKEN is required when MCP_TRANSPORT=http");
  }

  const app = express();
  app.use(express.json({ limit: "20mb" }));
  app.use(config.httpPath, authMiddleware(config));

  // Binary upload side-channel: PUT /upload/:handle with raw image bytes.
  // Keeps large image data out of the JSON MCP tool-call path (which corrupts
  // big base64 strings). Authenticated by the same MCP_AUTH_TOKEN.
  app.put(
    `${UPLOAD_PATH}/:handle`,
    authMiddleware(config),
    express.raw({ type: "*/*", limit: `${config.maxImageMb * 2}mb` }),
    async (req: Request, res: Response) => {
      const handle = Array.isArray(req.params.handle) ? req.params.handle[0] : req.params.handle;
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

      try {
        uploadStore.stage(handle, body, mimeType);
      } catch (error) {
        res.status(404).json({ error: error instanceof Error ? error.message : String(error) });
        return;
      }

      console.error(`[vision-timing] upload.stage handle=${handle} bytes=${body.length} mime=${mimeType}`);
      res.status(200).json({ ok: true, upload_handle: handle, bytes: body.length });
    }
  );

  app.post(config.httpPath, async (req: Request, res: Response) => {
    const tReqStart = performance.now();
    const reqMethod = (req.body as { method?: string } | null)?.method ?? "?";
    const reqId = (req.body as { id?: string | number } | null)?.id ?? "?";
    console.error(`[vision-timing] http.req method=${reqMethod} id=${reqId} bodyBytes=${JSON.stringify(req.body ?? {}).length}`);

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
      console.error(`[vision-timing] http.resp method=${reqMethod} id=${reqId} total=${(tHandled - tReqStart).toFixed(1)}ms connect=${(tConnected - tReqStart).toFixed(1)}ms handle=${(tHandled - tConnected).toFixed(1)}ms status=${res.statusCode}`);
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
      logger.info(`vision-bridge-mcp HTTP listening on ${config.httpHost}:${config.httpPort}${config.httpPath}`);
      resolve();
    });
    server.on("error", reject);
  });
}

function authMiddleware(config: VisionBridgeConfig) {
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

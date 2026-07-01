#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { startHttpServer } from "./http-server.js";
import { createMcpServer } from "./mcp-server.js";
import { createVisionProvider } from "./providers/provider-factory.js";
import { logger } from "./utils/logger.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const provider = createVisionProvider(config);

  if (config.transport === "http") {
    await startHttpServer(config, provider);
    return;
  }

  const server = createMcpServer(config, provider);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  logger.error(error instanceof Error ? error.message : "Failed to start vision-bridge-mcp");
  process.exit(1);
});

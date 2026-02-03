import { config } from "./config.js";
import { logger } from "./utils/logger.js";
import {
  createMatrixClient,
  startMatrixClient,
  stopMatrixClient,
} from "./matrix/client.js";
import { handleMessage } from "./matrix/handlers.js";
import { loadRoomSettings } from "./storage/room-settings.js";
import { getAvailableAliases, getModelDisplayName } from "./llm/model-aliases.js";

let isShuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

  logger.info(`Received ${signal}, shutting down gracefully...`);

  try {
    await stopMatrixClient();
  } catch (error) {
    logger.error("Error during shutdown", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  process.exit(0);
}

async function main(): Promise<void> {
  const availableModels = getAvailableAliases();
  
  logger.info("Starting AiAnswerBot", {
    version: "1.0.0",
    homeserver: config.matrix.homeserverUrl,
    userId: config.matrix.userId,
    commandPrefix: config.bot.commandPrefix,
    defaultModel: getModelDisplayName(config.models.default),
    availableModels: availableModels.length,
  });

  // Load room settings from disk
  loadRoomSettings();

  // Create Matrix client
  createMatrixClient();

  // Setup graceful shutdown
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  // Start the Matrix client
  await startMatrixClient(handleMessage);

  logger.info("AiAnswerBot is running. Press Ctrl+C to stop.");
  logger.info(`Use "${config.bot.commandPrefix} -ajuda" in a Matrix room to see available commands.`);
}

main().catch((error) => {
  logger.error("Fatal error", {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  process.exit(1);
});

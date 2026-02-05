import {
  MatrixClient,
  SimpleFsStorageProvider,
  AutojoinRoomsMixin,
} from "matrix-bot-sdk";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

let client: MatrixClient | null = null;
let startTimestamp: number = 0;

export function getMatrixClient(): MatrixClient {
  if (!client) {
    throw new Error("Matrix client not initialized. Call createMatrixClient() first.");
  }
  return client;
}

export function getStartTimestamp(): number {
  return startTimestamp;
}

export function createMatrixClient(): MatrixClient {
  const storage = new SimpleFsStorageProvider(config.bot.stateFile);

  client = new MatrixClient(
    config.matrix.homeserverUrl,
    config.matrix.accessToken,
    storage
  );

  // Auto-accept room invites
  AutojoinRoomsMixin.setupOnClient(client);

  logger.info("Matrix client created", {
    homeserver: config.matrix.homeserverUrl,
    userId: config.matrix.userId,
  });

  return client;
}

export async function startMatrixClient(
  onMessage: (roomId: string, event: Record<string, unknown>) => Promise<void>
): Promise<void> {
  const matrixClient = getMatrixClient();

  // Record start timestamp to ignore old messages
  startTimestamp = Date.now();

  // Register message handler
  matrixClient.on("room.message", async (roomId: string, event: Record<string, unknown>) => {
    await onMessage(roomId, event);
  });

  // Start syncing
  await matrixClient.start();
  logger.info("Matrix client started and syncing", { startTimestamp });
}

export async function stopMatrixClient(): Promise<void> {
  if (client) {
    client.stop();
    logger.info("Matrix client stopped");
  }
}

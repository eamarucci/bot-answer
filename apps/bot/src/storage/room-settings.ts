import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

export interface RoomSettings {
  model: string | null;
  systemPrompt: string | null;
  updatedAt: string;
}

interface RoomSettingsStore {
  [roomId: string]: RoomSettings;
}

let store: RoomSettingsStore = {};

function ensureDirectoryExists(filePath: string): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function loadRoomSettings(): void {
  const filePath = config.bot.roomSettingsFile;
  
  try {
    if (existsSync(filePath)) {
      const data = readFileSync(filePath, "utf-8");
      store = JSON.parse(data);
      logger.info("Room settings loaded", { roomCount: Object.keys(store).length });
    } else {
      store = {};
      logger.info("No room settings file found, starting fresh");
    }
  } catch (error) {
    logger.error("Error loading room settings", {
      error: error instanceof Error ? error.message : String(error),
    });
    store = {};
  }
}

export function saveRoomSettings(): void {
  const filePath = config.bot.roomSettingsFile;
  
  try {
    ensureDirectoryExists(filePath);
    writeFileSync(filePath, JSON.stringify(store, null, 2), "utf-8");
    logger.debug("Room settings saved");
  } catch (error) {
    logger.error("Error saving room settings", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function getRoomSettings(roomId: string): RoomSettings {
  return store[roomId] || {
    model: null,
    systemPrompt: null,
    updatedAt: new Date().toISOString(),
  };
}

export function setRoomModel(roomId: string, model: string): void {
  const current = getRoomSettings(roomId);
  store[roomId] = {
    ...current,
    model,
    updatedAt: new Date().toISOString(),
  };
  saveRoomSettings();
  logger.info("Room model updated", { roomId, model });
}

export function setRoomSystemPrompt(roomId: string, systemPrompt: string): void {
  const current = getRoomSettings(roomId);
  store[roomId] = {
    ...current,
    systemPrompt,
    updatedAt: new Date().toISOString(),
  };
  saveRoomSettings();
  logger.info("Room system prompt updated", { roomId, promptLength: systemPrompt.length });
}

export function resetRoomSettings(roomId: string): void {
  delete store[roomId];
  saveRoomSettings();
  logger.info("Room settings reset", { roomId });
}

export function getEffectiveModel(roomId: string): string {
  const settings = getRoomSettings(roomId);
  return settings.model || config.models.default;
}

export function getEffectiveSystemPrompt(roomId: string): string {
  const settings = getRoomSettings(roomId);
  const basePrompt = config.systemPrompts.base;
  const customPrompt = settings.systemPrompt || config.systemPrompts.default;
  
  // Combine base (fixed rules) + custom (editable context)
  return `${basePrompt}\n\nContexto adicional: ${customPrompt}`;
}

export function getCustomSystemPrompt(roomId: string): string {
  const settings = getRoomSettings(roomId);
  return settings.systemPrompt || config.systemPrompts.default;
}

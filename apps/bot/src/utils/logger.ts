import { config } from "../config.js";

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[config.bot.logLevel];
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

function formatMessage(level: LogLevel, message: string, data?: Record<string, unknown>): string {
  const timestamp = formatTimestamp();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  
  if (data && Object.keys(data).length > 0) {
    return `${prefix} ${message} ${JSON.stringify(data)}`;
  }
  return `${prefix} ${message}`;
}

export const logger = {
  debug(message: string, data?: Record<string, unknown>): void {
    if (shouldLog("debug")) {
      console.debug(formatMessage("debug", message, data));
    }
  },

  info(message: string, data?: Record<string, unknown>): void {
    if (shouldLog("info")) {
      console.info(formatMessage("info", message, data));
    }
  },

  warn(message: string, data?: Record<string, unknown>): void {
    if (shouldLog("warn")) {
      console.warn(formatMessage("warn", message, data));
    }
  },

  error(message: string, data?: Record<string, unknown>): void {
    if (shouldLog("error")) {
      console.error(formatMessage("error", message, data));
    }
  },
};

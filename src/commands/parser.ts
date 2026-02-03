import { config } from "../config.js";

export type CommandType = 
  | "ask"
  | "set-model"
  | "set-prompt"
  | "list-models"
  | "show-config"
  | "reset"
  | "help"
  | "unknown";

export interface ParsedCommand {
  type: CommandType;
  args: string;
  raw: string;
}

/**
 * Parse a command message.
 * 
 * Supported formats:
 * - /ia <message>           -> ask
 * - /ia -set <model>        -> set-model
 * - /ia -prompt <prompt>    -> set-prompt
 * - /ia -modelos            -> list-models
 * - /ia -config             -> show-config
 * - /ia -reset              -> reset
 * - /ia -ajuda              -> help
 */
export function parseCommand(body: string): ParsedCommand | null {
  const prefix = config.bot.commandPrefix;
  const trimmedBody = body.trim();
  
  // Check if message starts with command prefix
  if (!trimmedBody.startsWith(prefix)) {
    return null;
  }

  // Extract the part after the prefix
  const afterPrefix = trimmedBody.slice(prefix.length).trim();

  // Empty command (just "/ia")
  if (!afterPrefix) {
    return {
      type: "help",
      args: "",
      raw: body,
    };
  }

  // Check for flag commands
  if (afterPrefix.startsWith("-")) {
    return parseFlagCommand(afterPrefix, body);
  }

  // Default: ask command
  return {
    type: "ask",
    args: afterPrefix,
    raw: body,
  };
}

function parseFlagCommand(afterPrefix: string, raw: string): ParsedCommand {
  // Split by first space to get flag and args
  const spaceIndex = afterPrefix.indexOf(" ");
  const flag = spaceIndex === -1 ? afterPrefix : afterPrefix.slice(0, spaceIndex);
  const args = spaceIndex === -1 ? "" : afterPrefix.slice(spaceIndex + 1).trim();

  const flagLower = flag.toLowerCase();

  switch (flagLower) {
    case "-set":
    case "-modelo":
    case "-model":
      return { type: "set-model", args, raw };

    case "-prompt":
    case "-system":
    case "-systemprompt":
      return { type: "set-prompt", args, raw };

    case "-modelos":
    case "-models":
    case "-list":
      return { type: "list-models", args, raw };

    case "-config":
    case "-status":
      return { type: "show-config", args, raw };

    case "-reset":
    case "-limpar":
    case "-clear":
      return { type: "reset", args, raw };

    case "-ajuda":
    case "-help":
    case "-h":
      return { type: "help", args, raw };

    default:
      return { type: "unknown", args: flag, raw };
  }
}

/**
 * Check if a message body starts with the command prefix.
 */
export function isCommand(body: string): boolean {
  const prefix = config.bot.commandPrefix;
  const trimmedBody = body.trim();
  
  // Must be exactly the prefix or prefix followed by space
  return trimmedBody === prefix || trimmedBody.startsWith(prefix + " ");
}

/**
 * Strip reply quote from message body.
 * Matrix replies include the quoted message at the start.
 */
export function stripReplyQuote(body: string): string {
  // Matrix reply format: "> <@user:server> message\n\nActual reply"
  const lines = body.split("\n");
  const nonQuoteLines: string[] = [];
  let foundNonQuote = false;

  for (const line of lines) {
    if (foundNonQuote) {
      nonQuoteLines.push(line);
    } else if (!line.startsWith(">") && line.trim() !== "") {
      foundNonQuote = true;
      nonQuoteLines.push(line);
    }
  }

  return nonQuoteLines.join("\n").trim();
}

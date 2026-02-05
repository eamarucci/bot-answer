import { config } from "../config.js";

export type CommandType = 
  | "ask"
  | "set-model"
  | "set-prompt"
  | "list-models"
  | "show-config"
  | "reset"
  | "help"
  | "confirm"
  | "unknown";

export interface ParsedCommand {
  type: CommandType;
  args: string;
  raw: string;
}

/**
 * Gera padroes de mencao do WhatsApp para o numero do relay.
 * Retorna array de possiveis formatos de mencao.
 * Ex: ["@5511999999999", "@+5511999999999"]
 * 
 * So retorna padroes se MENTION_TRIGGER_ENABLED=true e relayNumber for fornecido.
 */
function getMentionPatterns(relayNumber?: string): string[] {
  // Verifica se mencao como trigger esta habilitada
  if (!config.bot.mentionTriggerEnabled) return [];
  
  if (!relayNumber) return [];
  
  // Remove caracteres nao numericos para normalizar
  const cleanNumber = relayNumber.replace(/\D/g, '');
  
  // Padroes comuns de mencao no WhatsApp
  return [
    `@${cleanNumber}`,           // @5511999999999
    `@+${cleanNumber}`,          // @+5511999999999
  ];
}

/**
 * Verifica se o body contem uma mencao ao relay e extrai a mensagem.
 * Retorna o texto apos a mencao, ou null se nao for mencao.
 */
function extractMentionMessage(body: string, relayNumber?: string): string | null {
  const patterns = getMentionPatterns(relayNumber);
  if (patterns.length === 0) return null;
  
  const trimmedBody = body.trim();
  
  for (const pattern of patterns) {
    if (trimmedBody.startsWith(pattern)) {
      // Extrai o texto apos a mencao
      return trimmedBody.slice(pattern.length).trim();
    }
  }
  
  return null;
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
 * - @5511999999999 <msg>    -> ask (mencao ao relay da sala)
 * 
 * @param body - Corpo da mensagem
 * @param relayNumber - Numero do relay da sala (para trigger por mencao)
 */
export function parseCommand(body: string, relayNumber?: string): ParsedCommand | null {
  const prefix = config.bot.commandPrefix;
  const trimmedBody = body.trim();
  
  // Primeiro verifica mencao ao relay da sala
  const mentionMessage = extractMentionMessage(trimmedBody, relayNumber);
  if (mentionMessage !== null) {
    // Mencao ao relay - trata como comando ask
    if (!mentionMessage) {
      return {
        type: "help",
        args: "",
        raw: body,
      };
    }
    
    // Se a mencao for seguida de uma flag, processa como flag
    if (mentionMessage.startsWith("-")) {
      return parseFlagCommand(mentionMessage, body);
    }
    
    return {
      type: "ask",
      args: mentionMessage,
      raw: body,
    };
  }
  
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

    case "-confirmar":
    case "-confirm":
    case "-verificar":
      return { type: "confirm", args, raw };

    default:
      return { type: "unknown", args: flag, raw };
  }
}

/**
 * Check if a message body starts with the command prefix or is a mention to the relay.
 * 
 * @param body - Corpo da mensagem
 * @param relayNumber - Numero do relay da sala (para trigger por mencao)
 */
export function isCommand(body: string, relayNumber?: string): boolean {
  const prefix = config.bot.commandPrefix;
  const trimmedBody = body.trim();
  
  // Check command prefix first
  if (trimmedBody === prefix || trimmedBody.startsWith(prefix + " ")) {
    return true;
  }
  
  // Check mention patterns (if enabled and relayNumber provided)
  const mentionPatterns = getMentionPatterns(relayNumber);
  for (const pattern of mentionPatterns) {
    if (trimmedBody.startsWith(pattern)) {
      return true;
    }
  }
  
  return false;
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

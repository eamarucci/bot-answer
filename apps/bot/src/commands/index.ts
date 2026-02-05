import { MatrixClient } from "matrix-bot-sdk";
import { parseCommand, type ParsedCommand } from "./parser.js";
import {
  handleHelp,
  handleListModels,
  handleShowConfig,
  handleSetModel,
  handleSetPrompt,
  handleReset,
  handleConfirm,
} from "./handlers/index.js";
import { handleAsk } from "./handlers/ask.js";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

export interface CommandResult {
  response: string;
  isError?: boolean;
}

export async function processCommand(
  client: MatrixClient,
  roomId: string,
  body: string,
  replyToEventId?: string,
  sender?: string,
  relayNumber?: string
): Promise<CommandResult> {
  const parsed = parseCommand(body, relayNumber);

  if (!parsed) {
    return {
      response: "Comando nao reconhecido.",
      isError: true,
    };
  }

  logger.debug("Processing command", {
    type: parsed.type,
    args: parsed.args.substring(0, 50),
    roomId,
  });

  switch (parsed.type) {
    case "ask":
      return handleAskCommand(client, roomId, parsed.args, replyToEventId, sender);

    case "set-model":
      const setModelResult = handleSetModel(roomId, parsed.args);
      return {
        response: setModelResult.message,
        isError: !setModelResult.success,
      };

    case "set-prompt":
      const setPromptResult = handleSetPrompt(roomId, parsed.args);
      return {
        response: setPromptResult.message,
        isError: !setPromptResult.success,
      };

    case "list-models":
      return {
        response: handleListModels(roomId),
      };

    case "show-config":
      return {
        response: handleShowConfig(roomId),
      };

    case "reset":
      return {
        response: handleReset(roomId),
      };

    case "help":
      return {
        response: handleHelp(),
      };

    case "confirm":
      return handleConfirmCommand(roomId, parsed.args, sender);

    case "unknown":
      return {
        response: `Flag desconhecida: ${parsed.args}\n\nUse "${config.bot.commandPrefix} -ajuda" para ver os comandos disponiveis.`,
        isError: true,
      };

    default:
      return {
        response: `Comando nao implementado: ${parsed.type}`,
        isError: true,
      };
  }
}

async function handleAskCommand(
  client: MatrixClient,
  roomId: string,
  message: string,
  replyToEventId?: string,
  sender?: string
): Promise<CommandResult> {
  if (!message.trim()) {
    return {
      response: `Uso: ${config.bot.commandPrefix} <sua pergunta>\n\nExemplo: ${config.bot.commandPrefix} Qual e a capital da Franca?`,
      isError: true,
    };
  }

  const result = await handleAsk(client, roomId, message, replyToEventId, sender);

  if (!result.success) {
    return {
      response: result.error || "Erro ao processar a requisicao.",
      isError: true,
    };
  }

  // Add model signature to response
  const signature = result.model ? `\n\n_via ${result.model}_` : "";
  
  return {
    response: (result.response || "Sem resposta.") + signature,
  };
}

async function handleConfirmCommand(
  roomId: string,
  code: string,
  sender?: string
): Promise<CommandResult> {
  if (!sender) {
    return {
      response: "Erro: sender nao identificado.",
      isError: true,
    };
  }

  const result = await handleConfirm(roomId, code.trim(), sender);
  
  return {
    response: result.message,
    isError: !result.success,
  };
}

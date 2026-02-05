import { config } from "../../config.js";
import {
  resolveModelAlias,
  getModelDisplayName,
  getAliasList,
} from "../../llm/model-aliases.js";
import { setRoomModel } from "../../storage/room-settings.js";

export interface SetModelResult {
  success: boolean;
  message: string;
}

export function handleSetModel(roomId: string, modelArg: string): SetModelResult {
  if (!modelArg.trim()) {
    const aliases = getAliasList().join(", ");
    return {
      success: false,
      message: `Uso: ${config.bot.commandPrefix} -set <modelo>\n\nModelos: ${aliases}\n\nUse "${config.bot.commandPrefix} -modelos" para mais detalhes.`,
    };
  }

  const modelInput = modelArg.trim();

  // Resolve alias to full model ID
  const fullModelId = resolveModelAlias(modelInput);

  if (!fullModelId) {
    const aliases = getAliasList().join(", ");
    return {
      success: false,
      message: `Modelo '${modelInput}' nao encontrado.\n\nModelos disponiveis: ${aliases}`,
    };
  }

  // Set the model for the room
  setRoomModel(roomId, fullModelId);

  const displayName = getModelDisplayName(fullModelId);

  return {
    success: true,
    message: `Modelo alterado para: ${displayName}`,
  };
}

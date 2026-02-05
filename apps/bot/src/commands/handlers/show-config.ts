import { config } from "../../config.js";
import { getModelDisplayName } from "../../llm/model-aliases.js";
import {
  getRoomSettings,
  getEffectiveModel,
  getCustomSystemPrompt,
} from "../../storage/room-settings.js";

export function handleShowConfig(roomId: string): string {
  const settings = getRoomSettings(roomId);
  const effectiveModel = getEffectiveModel(roomId);
  const customPrompt = getCustomSystemPrompt(roomId);

  const modelSource = settings.model ? "personalizado" : "padrao";
  const promptSource = settings.systemPrompt ? "personalizado" : "padrao";

  // Truncate prompt for display
  const displayPrompt =
    customPrompt.length > 100
      ? customPrompt.substring(0, 100) + "..."
      : customPrompt;

  const displayModel = getModelDisplayName(effectiveModel);

  return `Configuracao desta sala:

Modelo: ${displayModel} (${modelSource})
Contexto: "${displayPrompt}" (${promptSource})

Use "${config.bot.commandPrefix} -modelos" para ver modelos disponiveis.
Use "${config.bot.commandPrefix} -prompt <texto>" para definir contexto.
Use "${config.bot.commandPrefix} -reset" para voltar aos padroes.`;
}

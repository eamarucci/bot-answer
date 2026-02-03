import { config } from "../../config.js";
import {
  getAvailableAliases,
  getModelDisplayName,
} from "../../llm/model-aliases.js";
import { getEffectiveModel } from "../../storage/room-settings.js";

export function handleListModels(roomId: string): string {
  const currentModelId = getEffectiveModel(roomId);
  const currentDisplayName = getModelDisplayName(currentModelId);
  const aliases = getAvailableAliases();

  const modelList = aliases
    .map((model) => {
      const isCurrent = model.id === currentModelId;
      const marker = isCurrent ? " <- atual" : "";
      return `- ${model.alias}: ${model.description}${marker}`;
    })
    .join("\n");

  return `Modelos disponiveis:\n\n${modelList}\n\nUse "${config.bot.commandPrefix} -set <modelo>" para alterar.\nExemplo: ${config.bot.commandPrefix} -set deepseek`;
}

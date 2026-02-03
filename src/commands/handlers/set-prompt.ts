import { config } from "../../config.js";
import { setRoomSystemPrompt } from "../../storage/room-settings.js";

export interface SetPromptResult {
  success: boolean;
  message: string;
}

export function handleSetPrompt(roomId: string, promptArg: string): SetPromptResult {
  const prompt = promptArg.trim();

  if (!prompt) {
    return {
      success: false,
      message: `Uso: ${config.bot.commandPrefix} -prompt <seu prompt aqui>\n\nExemplo: ${config.bot.commandPrefix} -prompt Voce e um especialista em programacao Python.`,
    };
  }

  // Set the prompt for the room
  setRoomSystemPrompt(roomId, prompt);

  // Truncate for display
  const displayPrompt = prompt.length > 80 ? prompt.substring(0, 80) + "..." : prompt;

  return {
    success: true,
    message: `System prompt atualizado: "${displayPrompt}"`,
  };
}

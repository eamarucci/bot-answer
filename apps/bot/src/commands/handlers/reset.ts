import { resetRoomSettings } from "../../storage/room-settings.js";

export function handleReset(roomId: string): string {
  resetRoomSettings(roomId);
  return "Configuracao da sala resetada para os padroes.";
}

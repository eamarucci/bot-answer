import { config } from "../../config.js";

export function handleHelp(): string {
  const prefix = config.bot.commandPrefix;
  
  return `Comandos disponiveis:

${prefix} <mensagem>
  Envia uma pergunta para a IA

${prefix} -set <modelo>
  Define o modelo de IA para esta sala

${prefix} -prompt <texto>
  Define o system prompt para esta sala

${prefix} -modelos
  Lista os modelos disponiveis

${prefix} -config
  Mostra a configuracao atual da sala

${prefix} -reset
  Reseta a configuracao da sala para os padroes

${prefix} -ajuda
  Mostra esta mensagem de ajuda`;
}

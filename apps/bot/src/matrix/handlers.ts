import { MatrixClient } from "matrix-bot-sdk";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import { getStartTimestamp, getMatrixClient } from "./client.js";
import { isCommand, stripReplyQuote } from "../commands/parser.js";
import { processCommand } from "../commands/index.js";
import { getRelayPhoneForRoom } from "../auth/resolve-phone.js";

interface MatrixEvent {
  event_id: string;
  sender: string;
  origin_server_ts: number;
  content: {
    msgtype?: string;
    body?: string;
    formatted_body?: string;
    "m.relates_to"?: {
      "m.in_reply_to"?: {
        event_id: string;
      };
    };
    "m.mentions"?: {
      user_ids?: string[];
    };
  };
  type: string;
}

// Track processed events to prevent duplicates
const processedEvents = new Set<string>();
const MAX_PROCESSED_EVENTS = 1000;

/**
 * Extrai a mensagem apos a mencao.
 * Remove o link de mencao do formatted_body ou o nome do contato do body.
 */
function extractMessageAfterMention(formattedBody?: string, body?: string): string {
  // Tenta extrair do formatted_body primeiro (mais confiavel)
  if (formattedBody) {
    // Remove tags <a>...</a> de mencao e pega o resto
    // Formato: <a href="https://matrix.to/#/@user:server">Nome</a> mensagem
    const withoutMention = formattedBody
      .replace(/<a\s+href="https:\/\/matrix\.to\/#\/@[^"]+">.*?<\/a>\s*/gi, '')
      .trim();
    
    if (withoutMention) {
      return withoutMention;
    }
  }
  
  // Fallback: remove o primeiro "token" do body (que seria o nome do contato)
  if (body) {
    // Se o body comeca com um nome seguido de espaco, remove
    // Ex: "Bot (WA) mensagem" -> "mensagem"
    // Tenta detectar padroes comuns de nome de contato
    const match = body.match(/^[^@\s][^\n]*?\)\s+(.+)$/s) || // Nome (algo) mensagem
                  body.match(/^@\S+\s+(.+)$/s) ||             // @nome mensagem
                  body.match(/^\S+\s+(.+)$/s);                // Nome mensagem
    
    if (match) {
      return match[1].trim();
    }
  }
  
  return body?.trim() || '';
}

export async function handleMessage(
  roomId: string,
  event: Record<string, unknown>
): Promise<void> {
  const typedEvent = event as unknown as MatrixEvent;
  const client = getMatrixClient();

  // Log all incoming events for debugging
  logger.debug("Event received", {
    eventId: typedEvent.event_id,
    sender: typedEvent.sender,
    type: typedEvent.type,
    msgtype: typedEvent.content?.msgtype,
    body: typedEvent.content?.body?.substring(0, 100),
    formatted_body: (typedEvent.content as Record<string, unknown>)?.formatted_body?.toString().substring(0, 200),
    mentions: JSON.stringify((typedEvent.content as Record<string, unknown>)?.["m.mentions"]),
  });

  // Ignore own messages
  if (typedEvent.sender === config.matrix.userId) {
    return;
  }

  // Deduplicate events by event_id
  if (processedEvents.has(typedEvent.event_id)) {
    logger.debug("Ignoring duplicate event", { eventId: typedEvent.event_id });
    return;
  }

  // Deduplicate by content hash (for double puppet duplicates)
  const contentHash = `${typedEvent.sender}:${typedEvent.content?.body}:${Math.floor(typedEvent.origin_server_ts / 2000)}`;
  if (processedEvents.has(contentHash)) {
    logger.debug("Ignoring duplicate content", { eventId: typedEvent.event_id, contentHash });
    return;
  }

  // Ignore events that happened before the bot started
  const startTs = getStartTimestamp();
  if (typedEvent.origin_server_ts < startTs) {
    logger.debug("Ignoring old event", {
      eventTs: typedEvent.origin_server_ts,
      startTs,
    });
    return;
  }

  // Only handle text messages
  const content = typedEvent.content;
  if (content?.msgtype !== "m.text") {
    return;
  }

  // Get the message body and strip reply quotes if present
  let body = content.body?.trim();
  if (!body) return;

  // Strip reply quote to get the actual command
  body = stripReplyQuote(body);

  // Verifica se é mencao ao bot via m.mentions
  let isBotMention = false;
  let mentionMessage: string | null = null;
  
  if (config.bot.mentionTriggerEnabled) {
    const mentionedUsers = content["m.mentions"]?.user_ids || [];
    
    // Verifica se o bot foi mencionado
    // Pode ser pelo Matrix user ID do bot OU pelo relay da sala
    const relayNumber = await getRelayPhoneForRoom(roomId);
    const relayMatrixId = relayNumber ? `@whatsapp_${relayNumber}:${config.matrix.userId.split(':')[1]}` : null;
    
    // Extrai o servidor do bot para comparar mencoes
    const botServer = config.matrix.userId.split(':')[1];
    
    logger.debug("Checking mention", { 
      mentionedUsers, 
      botUserId: config.matrix.userId,
      relayMatrixId,
      relayNumber,
    });
    
    isBotMention = mentionedUsers.some(userId => {
      // Mencao direta ao bot Matrix
      if (userId === config.matrix.userId) return true;
      // Mencao ao relay do WhatsApp (que é o "bot" no grupo)
      if (relayMatrixId && userId === relayMatrixId) return true;
      // Mencao a qualquer usuario @bot* no mesmo servidor (pode ser alias)
      if (userId.startsWith('@bot') && userId.endsWith(`:${botServer}`)) return true;
      // Mencao a qualquer usuario @whatsapp* que contenha o numero do relay
      if (relayNumber && userId.includes(relayNumber)) return true;
      return false;
    });
    
    if (isBotMention) {
      // Extrai a mensagem removendo a mencao do formatted_body ou body
      mentionMessage = extractMessageAfterMention(content.formatted_body, content.body);
      logger.debug("Bot mention detected", { mentionedUsers, mentionMessage });
    }
  }

  // Busca o numero do relay para verificar mencao por @numero (fallback)
  let relayNumber: string | null = null;
  if (config.bot.mentionTriggerEnabled && !isBotMention) {
    relayNumber = await getRelayPhoneForRoom(roomId);
  }

  // Check for command trigger (prefix, mencao ao bot, ou mencao ao relay por numero)
  const isCommandTrigger = isCommand(body, relayNumber || undefined);
  
  if (!isBotMention && !isCommandTrigger) {
    return;
  }
  
  // Se foi mencao ao bot, usa a mensagem extraida
  if (isBotMention && mentionMessage !== null) {
    body = mentionMessage;
  }

  // Mark event as processed to prevent duplicates
  processedEvents.add(typedEvent.event_id);
  processedEvents.add(contentHash);

  // Clean up old events to prevent memory leak
  if (processedEvents.size > MAX_PROCESSED_EVENTS) {
    const toDelete = Array.from(processedEvents).slice(0, 200);
    toDelete.forEach((id) => processedEvents.delete(id));
  }

  logger.info("Command received", {
    roomId,
    sender: typedEvent.sender,
    eventId: typedEvent.event_id,
    command: body.substring(0, 50),
    isBotMention,
  });

  try {
    // Show typing indicator
    await client.setTyping(roomId, true, 60000);

    // Get reply-to event ID if this is a reply
    const replyToEventId = content["m.relates_to"]?.["m.in_reply_to"]?.event_id;

    // Process the command
    // Se foi mencao direta ao bot, adiciona o prefixo para que parseCommand funcione
    const commandBody = isBotMention ? `${config.bot.commandPrefix} ${body}` : body;
    const result = await processCommand(client, roomId, commandBody, replyToEventId, typedEvent.sender, relayNumber || undefined);

    // Stop typing indicator
    await client.setTyping(roomId, false);

    // Send response - reply to the referenced message if exists, otherwise to the command
    const responseTarget = replyToEventId || typedEvent.event_id;
    await sendReply(client, roomId, responseTarget, result.response);

    logger.info("Response sent", {
      roomId,
      eventId: typedEvent.event_id,
      responseLength: result.response.length,
      isError: result.isError,
    });
  } catch (error) {
    logger.error("Error processing command", {
      error: error instanceof Error ? error.message : String(error),
      roomId,
      eventId: typedEvent.event_id,
    });

    await client.setTyping(roomId, false);
    await sendReply(
      client,
      roomId,
      typedEvent.event_id,
      "Ocorreu um erro ao processar o comando. Tente novamente."
    );
  }
}

async function sendReply(
  client: MatrixClient,
  roomId: string,
  replyToEventId: string,
  text: string
): Promise<void> {
  // Format for HTML (convert newlines to <br>)
  const htmlText = escapeHtml(text).replace(/\n/g, "<br>");

  await client.sendMessage(roomId, {
    msgtype: "m.text",
    body: text,
    format: "org.matrix.custom.html",
    formatted_body: htmlText,
    "m.relates_to": {
      "m.in_reply_to": {
        event_id: replyToEventId,
      },
    },
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

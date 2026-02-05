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
    "m.relates_to"?: {
      "m.in_reply_to"?: {
        event_id: string;
      };
    };
  };
  type: string;
}

// Track processed events to prevent duplicates
const processedEvents = new Set<string>();
const MAX_PROCESSED_EVENTS = 1000;

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
    body: typedEvent.content?.body?.substring(0, 50),
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

  // Busca o numero do relay da sala para verificar mencao (se habilitado)
  let relayNumber: string | null = null;
  if (config.bot.mentionTriggerEnabled) {
    relayNumber = await getRelayPhoneForRoom(roomId);
  }

  // Check for command trigger (prefix ou mencao ao relay)
  if (!isCommand(body, relayNumber || undefined)) {
    return;
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
  });

  try {
    // Show typing indicator
    await client.setTyping(roomId, true, 60000);

    // Get reply-to event ID if this is a reply
    const replyToEventId = content["m.relates_to"]?.["m.in_reply_to"]?.event_id;

    // Process the command (passing sender and relayNumber for permission check and parsing)
    const result = await processCommand(client, roomId, body, replyToEventId, typedEvent.sender, relayNumber || undefined);

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

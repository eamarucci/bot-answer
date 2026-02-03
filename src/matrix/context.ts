import { MatrixClient } from "matrix-bot-sdk";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import { isImageEvent, isVideoEvent } from "./image.js";
import type { ChatMessage } from "../llm/types.js";

interface MatrixEvent {
  event_id: string;
  sender: string;
  origin_server_ts: number;
  content: {
    msgtype?: string;
    body?: string;
    url?: string;
    info?: {
      mimetype?: string;
    };
    "m.relates_to"?: {
      "m.in_reply_to"?: {
        event_id: string;
      };
    };
  };
  type: string;
}

/**
 * Fetch message context for the LLM.
 * 
 * If replyToEventId is provided, fetches the reply chain.
 * Otherwise, fetches recent messages from the room.
 */
export async function fetchMessageContext(
  client: MatrixClient,
  roomId: string,
  replyToEventId?: string
): Promise<ChatMessage[]> {
  if (replyToEventId) {
    return fetchReplyChainContext(client, roomId, replyToEventId);
  } else {
    return fetchRecentMessagesContext(client, roomId);
  }
}

/**
 * Fetch the reply chain as context.
 * Follows the reply chain backwards to build conversation history.
 */
async function fetchReplyChainContext(
  client: MatrixClient,
  roomId: string,
  eventId: string
): Promise<ChatMessage[]> {
  const messages: ChatMessage[] = [];
  const maxDepth = config.context.maxMessages;
  const botUserId = config.matrix.userId;

  let currentEventId: string | undefined = eventId;
  let depth = 0;

  while (currentEventId && depth < maxDepth) {
    try {
      const event = await client.getEvent(roomId, currentEventId) as MatrixEvent;

      if (!event || event.type !== "m.room.message") {
        break;
      }

      const content = event.content;
      if (content.msgtype !== "m.text" || !content.body) {
        break;
      }

      // Determine role based on sender
      const role: "user" | "assistant" = event.sender === botUserId ? "assistant" : "user";

      // Strip reply quote from body
      const body = stripReplyQuote(content.body);

      // Add to beginning (we're going backwards)
      messages.unshift({
        role,
        content: body,
      });

      // Follow the reply chain
      currentEventId = content["m.relates_to"]?.["m.in_reply_to"]?.event_id;
      depth++;
    } catch (error) {
      logger.warn("Error fetching event in reply chain", {
        eventId: currentEventId,
        error: error instanceof Error ? error.message : String(error),
      });
      break;
    }
  }

  logger.debug("Fetched reply chain context", {
    messagesCount: messages.length,
    depth,
  });

  return messages;
}

/**
 * Fetch recent messages from the room as context.
 */
async function fetchRecentMessagesContext(
  client: MatrixClient,
  roomId: string
): Promise<ChatMessage[]> {
  const messages: ChatMessage[] = [];
  const maxMessages = config.context.maxMessages;
  const maxAgeMs = config.context.maxAgeMinutes * 60 * 1000;
  const cutoffTime = Date.now() - maxAgeMs;
  const botUserId = config.matrix.userId;
  const commandPrefix = config.bot.commandPrefix;

  try {
    // Fetch recent room messages
    const response = await client.doRequest(
      "GET",
      `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/messages`,
      {
        dir: "b", // backwards
        limit: maxMessages * 2, // fetch more to filter
      }
    );

    const events = (response.chunk || []) as MatrixEvent[];

    for (const event of events) {
      if (messages.length >= maxMessages) {
        break;
      }

      // Skip non-message events
      if (event.type !== "m.room.message") {
        continue;
      }

      // Skip old messages
      if (event.origin_server_ts < cutoffTime) {
        break;
      }

      const content = event.content;
      
      // Only include text messages
      if (content.msgtype !== "m.text" || !content.body) {
        continue;
      }

      const body = content.body.trim();

      // Skip command messages (but include the response)
      if (body.startsWith(commandPrefix + " ") || body === commandPrefix) {
        continue;
      }

      // Skip empty messages
      if (!body) {
        continue;
      }

      // Determine role based on sender
      const role: "user" | "assistant" = event.sender === botUserId ? "assistant" : "user";

      // Strip reply quote from body
      const cleanBody = stripReplyQuote(body);

      // Add to beginning (we're going backwards)
      messages.unshift({
        role,
        content: cleanBody,
      });
    }
  } catch (error) {
    logger.warn("Error fetching recent messages", {
      roomId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  logger.debug("Fetched recent messages context", {
    messagesCount: messages.length,
  });

  return messages;
}

/**
 * Strip reply quote from message body.
 * Matrix replies include the quoted message at the start.
 */
function stripReplyQuote(body: string): string {
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

  return nonQuoteLines.join("\n").trim() || body;
}

export interface MediaReplyResult {
  event: Record<string, unknown>;
  type: "image" | "video";
}

/**
 * Check if a reply is referencing an image or video event.
 * Returns the media event and type if found, null otherwise.
 */
export async function checkForMediaInReply(
  client: MatrixClient,
  roomId: string,
  replyToEventId: string
): Promise<MediaReplyResult | null> {
  try {
    const event = await client.getEvent(roomId, replyToEventId);
    
    if (isVideoEvent(event)) {
      logger.debug("Reply references a video", { eventId: replyToEventId });
      return { event, type: "video" };
    }
    
    if (isImageEvent(event)) {
      logger.debug("Reply references an image", { eventId: replyToEventId });
      return { event, type: "image" };
    }

    return null;
  } catch (error) {
    logger.warn("Error checking for media in reply", {
      eventId: replyToEventId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Check if a reply is referencing an image event.
 * Returns the image event if found, null otherwise.
 * @deprecated Use checkForMediaInReply instead
 */
export async function checkForImageInReply(
  client: MatrixClient,
  roomId: string,
  replyToEventId: string
): Promise<Record<string, unknown> | null> {
  const result = await checkForMediaInReply(client, roomId, replyToEventId);
  if (result && result.type === "image") {
    return result.event;
  }
  return null;
}

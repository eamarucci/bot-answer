import { MatrixClient } from "matrix-bot-sdk";
import { config } from "../../config.js";
import { logger } from "../../utils/logger.js";
import { createChatCompletion } from "../../llm/openrouter-client.js";
import { getModelDisplayName, resolveModelAlias } from "../../llm/model-aliases.js";
import {
  getEffectiveModel,
  getEffectiveSystemPrompt,
} from "../../storage/room-settings.js";
import { fetchMessageContext, checkForMediaInReply } from "../../matrix/context.js";
import { fetchMediaFromEvent, type FetchedMedia } from "../../matrix/image.js";
import type { ChatMessage, ContentPart } from "../../llm/types.js";
import {
  resolvePhoneFromSender,
  checkPermission,
  getApiKey,
  getApiKeyFallback,
} from "../../auth/index.js";

// Max video size: 20MB (videos are large, need a reasonable limit)
const MAX_VIDEO_SIZE = 20 * 1024 * 1024;

export interface AskResult {
  success: boolean;
  response?: string;
  error?: string;
  model?: string;
}

export async function handleAsk(
  client: MatrixClient,
  roomId: string,
  userMessage: string,
  replyToEventId?: string,
  sender?: string
): Promise<AskResult> {
  // Resolve numero do sender
  let phoneNumber: string | null = null;
  if (sender) {
    phoneNumber = await resolvePhoneFromSender(sender);
    logger.debug("Resolved phone number", { sender, phoneNumber });
  }

  // Verifica permissao
  const permissionResult = phoneNumber
    ? await checkPermission(roomId, phoneNumber)
    : { allowed: true };

  if (!permissionResult.allowed) {
    return {
      success: false,
      error: permissionResult.reason || "Voce nao tem permissao para usar o bot neste grupo.",
    };
  }

  // Determina modelo (prioridade: config do grupo > room-settings.json > default)
  let model = permissionResult.groupConfig?.model
    ? resolveModelAlias(permissionResult.groupConfig.model) || getEffectiveModel(roomId)
    : getEffectiveModel(roomId);

  // Determina system prompt (prioridade: config do grupo > room-settings.json > default)
  const systemPrompt = permissionResult.groupConfig?.systemPrompt
    ? `${config.systemPrompts.base}\n\n${permissionResult.groupConfig.systemPrompt}`
    : getEffectiveSystemPrompt(roomId);

  let media: FetchedMedia | null = null;

  // Check if replying to an image or video
  if (replyToEventId) {
    const mediaResult = await checkForMediaInReply(client, roomId, replyToEventId);
    if (mediaResult) {
      // Fetch media (image or video)
      media = await fetchMediaFromEvent(client, mediaResult.event);
      
      if (media) {
        // Check video size limit
        if (media.type === "video" && media.size > MAX_VIDEO_SIZE) {
          const sizeMB = (media.size / 1024 / 1024).toFixed(1);
          logger.info("Video too large", { size: media.size, maxSize: MAX_VIDEO_SIZE });
          return {
            success: false,
            error: `Video muito grande (${sizeMB}MB). Limite: 20MB.`,
          };
        }
        
        // Switch to vision model automatically
        model = config.models.vision;
        logger.info("Media detected, switching to vision model", { 
          model, 
          mediaType: media.type,
          size: media.size 
        });
      }
    }
  }

  logger.info("Processing ask command", {
    roomId,
    model,
    messageLength: userMessage.length,
    hasReply: !!replyToEventId,
    hasMedia: !!media,
    mediaType: media?.type,
  });

  // Build messages array
  const messages: ChatMessage[] = [];

  // Add system prompt
  messages.push({
    role: "system",
    content: systemPrompt,
  });

  // Fetch context (previous messages or reply chain) - only if no media
  if (!media) {
    const contextMessages = await fetchMessageContext(client, roomId, replyToEventId);
    messages.push(...contextMessages);
  }

  // Add the current user message (with media if present)
  if (media) {
    // Multimodal message with image or video
    const contentParts: ContentPart[] = [];
    
    if (media.type === "video") {
      contentParts.push({
        type: "video_url",
        video_url: { url: media.base64 },
      });
    } else {
      contentParts.push({
        type: "image_url",
        image_url: { url: media.base64 },
      });
    }
    
    contentParts.push({
      type: "text",
      text: userMessage || (media.type === "video" ? "Descreva este video." : "Descreva esta imagem."),
    });
    
    messages.push({
      role: "user",
      content: contentParts,
    });
  } else {
    messages.push({
      role: "user",
      content: userMessage,
    });
  }

  // Busca chave API correta
  const isVision = !!media;
  const apiKeyResult = permissionResult.groupConfig
    ? await getApiKey(permissionResult, isVision)
    : await getApiKeyFallback(isVision);

  if (!apiKeyResult) {
    return {
      success: false,
      error: "Nenhuma chave API configurada. Admin: acesse bot-answer.marucci.cloud para configurar.",
    };
  }

  logger.debug("Sending messages to LLM", {
    totalMessages: messages.length,
    hasMedia: !!media,
    mediaType: media?.type,
    apiKeySource: apiKeyResult.source,
  });

  // Send to LLM
  const result = await createChatCompletion(messages, model, {
    apiKey: apiKeyResult.key,
  });

  if (!result.success) {
    logger.error("LLM request failed", {
      error: result.error?.message,
      model,
    });
    return {
      success: false,
      error: result.error?.userFriendly || "Erro ao processar a requisicao.",
    };
  }

  logger.info("LLM response received", {
    model: result.model,
    contentLength: result.content?.length,
    usage: result.usage,
  });

  return {
    success: true,
    response: result.content,
    model: getModelDisplayName(result.model || model),
  };
}

import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import {
  formatApiError,
  formatTimeoutError,
  formatContextTooLongError,
  formatGenericError,
  type FormattedError,
} from "../utils/errors.js";
import type {
  ChatMessage,
  ChatCompletionRequest,
  ChatCompletionResponse,
  OpenRouterError,
} from "./types.js";

export interface CompletionResult {
  success: boolean;
  content?: string;
  error?: FormattedError;
  model?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface CompletionOptions {
  apiKey?: string; // Se nao fornecido, usa config.openRouter.apiKey
}

export async function createChatCompletion(
  messages: ChatMessage[],
  model: string,
  options?: CompletionOptions
): Promise<CompletionResult> {
  const url = `${config.openRouter.baseUrl}/chat/completions`;
  const apiKey = options?.apiKey || config.openRouter.apiKey;

  const requestBody: ChatCompletionRequest = {
    model,
    messages,
    max_tokens: config.llm.maxTokens,
    stream: false,
    include_reasoning: config.llm.includeReasoning,
  };

  logger.debug("Sending request to OpenRouter", {
    model,
    messagesCount: messages.length,
    url,
    usingCustomKey: !!options?.apiKey,
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.llm.timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://github.com/eamarucci/bot-answer",
        "X-Title": "BotAnswer",
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as OpenRouterError;
      const errorMessage = errorData.error?.message || response.statusText;

      logger.error("OpenRouter API error", {
        status: response.status,
        message: errorMessage,
        model,
      });

      // Check for context length error
      if (
        errorMessage.toLowerCase().includes("context") ||
        errorMessage.toLowerCase().includes("token") ||
        errorMessage.toLowerCase().includes("length")
      ) {
        return {
          success: false,
          error: formatContextTooLongError(),
        };
      }

      return {
        success: false,
        error: formatApiError(response.status, errorMessage),
      };
    }

    const data = (await response.json()) as ChatCompletionResponse;

    if (!data.choices || data.choices.length === 0) {
      logger.error("OpenRouter returned no choices", { data });
      return {
        success: false,
        error: {
          message: "No response from model",
          userFriendly: "O modelo nao retornou uma resposta. Tente novamente.",
        },
      };
    }

    const content = data.choices[0].message.content;
    const finishReason = data.choices[0].finish_reason;

    logger.info("OpenRouter response received", {
      model: data.model,
      finishReason,
      contentLength: content.length,
      usage: data.usage,
    });

    let finalContent = content;

    // If response was truncated, add indicator
    if (finishReason === "length") {
      finalContent += "\n\n[...resposta truncada. Faca uma pergunta mais especifica para continuar]";
    }

    return {
      success: true,
      content: finalContent,
      model: data.model,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
    };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === "AbortError") {
      logger.error("OpenRouter request timed out", { model, timeoutMs: config.llm.timeoutMs });
      return {
        success: false,
        error: formatTimeoutError(),
      };
    }

    logger.error("OpenRouter request failed", {
      error: error instanceof Error ? error.message : String(error),
      model,
    });

    return {
      success: false,
      error: formatGenericError(error),
    };
  }
}



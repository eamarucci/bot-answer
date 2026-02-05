import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import {
  formatApiError,
  formatTimeoutError,
  formatContextTooLongError,
  formatGenericError,
  type FormattedError,
} from "../utils/errors.js";
import { PROVIDERS, type ProviderId } from "@botanswer/database";
import type {
  ChatMessage,
  ChatCompletionRequest,
  ChatCompletionResponse,
  OpenRouterError,
} from "./types.js";
import { getOAuthAccessToken, type OAuthProvider } from "./oauth-tokens.js";

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

export interface CompletionOptionsApi {
  type: 'api';
  apiKey: string;
  provider?: ProviderId;
}

export interface CompletionOptionsOAuth {
  type: 'oauth';
  adminId: string;
  oauthProvider: OAuthProvider;
  provider: ProviderId;
}

export type CompletionOptions = CompletionOptionsApi | CompletionOptionsOAuth;

// Headers especificos para OAuth Anthropic (mesmos do OpenCode/claude-cli)
const ANTHROPIC_OAUTH_HEADERS = {
  "anthropic-version": "2023-06-01",
  "anthropic-beta": "oauth-2025-04-20,interleaved-thinking-2025-05-14",
  "user-agent": "claude-cli/2.1.2 (external, cli)",
};

// URL para OAuth Anthropic (com beta=true)
const ANTHROPIC_OAUTH_URL = "https://api.anthropic.com/v1/messages?beta=true";

// Prefixo OBRIGATORIO para OAuth Anthropic funcionar
// A API da Anthropic valida que o system prompt comeca com essa frase
// quando usando credenciais OAuth do Claude Code
const CLAUDE_CODE_SYSTEM_PREFIX = "You are Claude Code, Anthropic's official CLI for Claude.";

/**
 * Converte mensagens do formato OpenAI para formato Anthropic
 */
function convertToAnthropicFormat(messages: ChatMessage[]): { 
  system?: string; 
  messages: Array<{ role: 'user' | 'assistant'; content: string | Array<{type: string; text?: string; source?: unknown}> }>;
} {
  let system: string | undefined;
  const anthropicMessages: Array<{ role: 'user' | 'assistant'; content: string | Array<{type: string; text?: string; source?: unknown}> }> = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      // Concatena system messages
      if (typeof msg.content === 'string') {
        system = system ? `${system}\n\n${msg.content}` : msg.content;
      }
    } else if (msg.role === 'user' || msg.role === 'assistant') {
      // Preserva formato com multimidia se presente
      if (typeof msg.content === 'string') {
        anthropicMessages.push({
          role: msg.role,
          content: msg.content,
        });
      } else {
        // Converte content parts para formato Anthropic
        const anthropicContent: Array<{type: string; text?: string; source?: unknown}> = [];
        for (const part of msg.content) {
          if (part.type === 'text') {
            anthropicContent.push({ type: 'text', text: part.text });
          } else if (part.type === 'image_url' && part.image_url) {
            // Converte image_url para formato Anthropic
            const url = part.image_url.url;
            if (url.startsWith('data:')) {
              // Base64 inline
              const match = url.match(/^data:([^;]+);base64,(.+)$/);
              if (match) {
                anthropicContent.push({
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: match[1],
                    data: match[2],
                  },
                });
              }
            } else {
              // URL externa
              anthropicContent.push({
                type: 'image',
                source: {
                  type: 'url',
                  url: url,
                },
              });
            }
          }
        }
        
        if (anthropicContent.length > 0) {
          anthropicMessages.push({
            role: msg.role,
            content: anthropicContent,
          });
        }
      }
    }
  }

  return { system, messages: anthropicMessages };
}

/**
 * Faz request para API do provedor e retorna resposta padronizada.
 */
export async function createChatCompletion(
  messages: ChatMessage[],
  model: string,
  options: CompletionOptions
): Promise<CompletionResult> {
  // Se for OAuth, precisa obter access token primeiro
  if (options.type === 'oauth') {
    return createChatCompletionOAuth(messages, model, options);
  }
  
  return createChatCompletionApi(messages, model, options);
}

/**
 * Completion usando API key tradicional
 */
async function createChatCompletionApi(
  messages: ChatMessage[],
  model: string,
  options: CompletionOptionsApi
): Promise<CompletionResult> {
  const provider = options.provider || 'openrouter';
  const providerConfig = PROVIDERS[provider];

  if (!providerConfig) {
    return {
      success: false,
      error: {
        message: `Provider desconhecido: ${provider}`,
        userFriendly: `Provedor "${provider}" nao e suportado.`,
      },
    };
  }

  const url = `${providerConfig.baseUrl}${providerConfig.chatEndpoint}`;

  // Monta headers
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Auth header (Anthropic usa x-api-key, outros usam Bearer)
  if (providerConfig.authHeader) {
    headers[providerConfig.authHeader] = options.apiKey;
  } else {
    headers["Authorization"] = `Bearer ${options.apiKey}`;
  }

  // Headers extras (ex: anthropic-version)
  if (providerConfig.extraHeaders) {
    Object.assign(headers, providerConfig.extraHeaders);
  }

  // Headers especificos do OpenRouter
  if (provider === 'openrouter') {
    headers["HTTP-Referer"] = "https://github.com/eamarucci/bot-answer";
    headers["X-Title"] = "BotAnswer";
  }

  // Monta body baseado no formato do provedor
  const requestBody = buildRequestBody(messages, model, providerConfig.responseFormat);

  return executeRequest(url, headers, requestBody, provider, model, providerConfig.responseFormat);
}

/**
 * Completion usando OAuth (Claude Pro/Max ou ChatGPT Plus/Pro)
 */
async function createChatCompletionOAuth(
  messages: ChatMessage[],
  model: string,
  options: CompletionOptionsOAuth
): Promise<CompletionResult> {
  const { adminId, oauthProvider, provider } = options;

  // Obtem access token do cache ou faz refresh
  const tokenResult = await getOAuthAccessToken(adminId, oauthProvider);
  
  if (!tokenResult.success) {
    return {
      success: false,
      error: {
        message: tokenResult.error,
        userFriendly: `Erro OAuth ${oauthProvider}: ${tokenResult.error}`,
      },
    };
  }

  const accessToken = tokenResult.accessToken;

  if (oauthProvider === 'anthropic') {
    return createAnthropicOAuthCompletion(messages, model, accessToken);
  } else {
    // OpenAI OAuth - TODO: Fase 2
    return {
      success: false,
      error: {
        message: 'OpenAI OAuth not implemented',
        userFriendly: 'OAuth OpenAI ainda nao foi implementado.',
      },
    };
  }
}

/**
 * Completion usando OAuth Anthropic (Claude Pro/Max)
 * 
 * IMPORTANTE: OAuth do Claude Code requer que o system prompt comece com
 * "You are Claude Code, Anthropic's official CLI for Claude."
 * Caso contrario a API retorna erro 400: "This credential is only authorized for use with Claude Code"
 * 
 * O system prompt deve ser enviado como array de text blocks para OAuth funcionar.
 */
async function createAnthropicOAuthCompletion(
  messages: ChatMessage[],
  model: string,
  accessToken: string
): Promise<CompletionResult> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${accessToken}`,
    ...ANTHROPIC_OAUTH_HEADERS,
  };

  // Converte mensagens para formato Anthropic
  const { system, messages: anthropicMessages } = convertToAnthropicFormat(messages);

  // Monta system prompt como array de text blocks (formato requerido para OAuth)
  // O primeiro bloco DEVE ser o prefixo do Claude Code
  const systemBlocks: Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }> = [
    { type: 'text', text: CLAUDE_CODE_SYSTEM_PREFIX },
  ];
  
  if (system) {
    systemBlocks.push({ 
      type: 'text', 
      text: system,
      cache_control: { type: 'ephemeral' }, // Cache para economizar tokens
    });
  }

  const requestBody = {
    model,
    max_tokens: config.llm.maxTokens,
    system: systemBlocks,
    messages: anthropicMessages,
  };

  logger.debug("Sending OAuth request to Anthropic", {
    model,
    messagesCount: messages.length,
    url: ANTHROPIC_OAUTH_URL,
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.llm.timeoutMs);

  try {
    const response = await fetch(ANTHROPIC_OAUTH_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = 
        (errorData as { error?: { message?: string } }).error?.message ||
        response.statusText;

      logger.error("Anthropic OAuth API error", {
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

    const data = await response.json() as {
      content: Array<{ type: string; text: string; thinking?: string }>;
      model: string;
      usage?: { input_tokens: number; output_tokens: number };
    };

    if (!data.content || data.content.length === 0) {
      logger.error("Anthropic OAuth returned no content", { data });
      return {
        success: false,
        error: {
          message: "No response from model",
          userFriendly: "O modelo nao retornou uma resposta. Tente novamente.",
        },
      };
    }

    // Processa conteudo (pode incluir thinking blocks com extended thinking)
    let content = '';
    for (const block of data.content) {
      if (block.type === 'text') {
        content += block.text;
      } else if (block.type === 'thinking' && block.thinking) {
        // Opcional: mostrar thinking em formato especial
        // Por ora, ignora o thinking para nao poluir a resposta
      }
    }

    const usage = data.usage ? {
      promptTokens: data.usage.input_tokens,
      completionTokens: data.usage.output_tokens,
      totalTokens: data.usage.input_tokens + data.usage.output_tokens,
    } : undefined;

    logger.info("Anthropic OAuth response received", {
      model: data.model,
      contentLength: content.length,
      usage,
    });

    return {
      success: true,
      content,
      model: data.model,
      usage,
    };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === "AbortError") {
      logger.error("Anthropic OAuth request timed out", { model, timeoutMs: config.llm.timeoutMs });
      return {
        success: false,
        error: formatTimeoutError(),
      };
    }

    logger.error("Anthropic OAuth request failed", {
      error: error instanceof Error ? error.message : String(error),
      model,
    });

    return {
      success: false,
      error: formatGenericError(error),
    };
  }
}

/**
 * Monta o body do request baseado no formato do provedor
 */
function buildRequestBody(
  messages: ChatMessage[],
  model: string,
  responseFormat: 'openai' | 'anthropic' | undefined
): unknown {
  if (responseFormat === 'anthropic') {
    // Formato Anthropic
    const { system, messages: anthropicMessages } = convertToAnthropicFormat(messages);
    return {
      model,
      max_tokens: config.llm.maxTokens,
      system,
      messages: anthropicMessages,
    };
  } else {
    // Formato OpenAI (openrouter, openai, groq)
    return {
      model,
      messages,
      max_tokens: config.llm.maxTokens,
      stream: false,
      include_reasoning: config.llm.includeReasoning,
    } as ChatCompletionRequest;
  }
}

/**
 * Executa request HTTP e processa resposta
 */
async function executeRequest(
  url: string,
  headers: Record<string, string>,
  requestBody: unknown,
  provider: string,
  model: string,
  responseFormat: 'openai' | 'anthropic' | undefined
): Promise<CompletionResult> {
  logger.debug("Sending request to LLM", {
    provider,
    model,
    url,
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.llm.timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = 
        // OpenAI format
        (errorData as OpenRouterError).error?.message ||
        // Anthropic format
        (errorData as { error?: { message?: string } }).error?.message ||
        response.statusText;

      logger.error("LLM API error", {
        provider,
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

    const data = await response.json();

    // Parse response baseado no formato
    let content: string;
    let actualModel: string;
    let usage: CompletionResult['usage'];

    if (responseFormat === 'anthropic') {
      // Formato Anthropic
      const anthropicData = data as {
        content: Array<{ type: string; text: string }>;
        model: string;
        usage?: { input_tokens: number; output_tokens: number };
      };

      if (!anthropicData.content || anthropicData.content.length === 0) {
        logger.error("Anthropic returned no content", { data });
        return {
          success: false,
          error: {
            message: "No response from model",
            userFriendly: "O modelo nao retornou uma resposta. Tente novamente.",
          },
        };
      }

      content = anthropicData.content
        .filter(c => c.type === 'text')
        .map(c => c.text)
        .join('\n');
      actualModel = anthropicData.model;
      
      if (anthropicData.usage) {
        usage = {
          promptTokens: anthropicData.usage.input_tokens,
          completionTokens: anthropicData.usage.output_tokens,
          totalTokens: anthropicData.usage.input_tokens + anthropicData.usage.output_tokens,
        };
      }
    } else {
      // Formato OpenAI
      const openaiData = data as ChatCompletionResponse;

      if (!openaiData.choices || openaiData.choices.length === 0) {
        logger.error("OpenAI format returned no choices", { data });
        return {
          success: false,
          error: {
            message: "No response from model",
            userFriendly: "O modelo nao retornou uma resposta. Tente novamente.",
          },
        };
      }

      content = openaiData.choices[0].message.content;
      actualModel = openaiData.model;
      const finishReason = openaiData.choices[0].finish_reason;

      // If response was truncated, add indicator
      if (finishReason === "length") {
        content += "\n\n[...resposta truncada. Faca uma pergunta mais especifica para continuar]";
      }

      if (openaiData.usage) {
        usage = {
          promptTokens: openaiData.usage.prompt_tokens,
          completionTokens: openaiData.usage.completion_tokens,
          totalTokens: openaiData.usage.total_tokens,
        };
      }
    }

    logger.info("LLM response received", {
      provider,
      model: actualModel,
      contentLength: content.length,
      usage,
    });

    return {
      success: true,
      content,
      model: actualModel,
      usage,
    };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === "AbortError") {
      logger.error("LLM request timed out", { provider, model, timeoutMs: config.llm.timeoutMs });
      return {
        success: false,
        error: formatTimeoutError(),
      };
    }

    logger.error("LLM request failed", {
      error: error instanceof Error ? error.message : String(error),
      provider,
      model,
    });

    return {
      success: false,
      error: formatGenericError(error),
    };
  }
}

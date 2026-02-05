/**
 * Configuracao de provedores de LLM suportados.
 * Compartilhado entre bot e web.
 */

export type ProviderId = 'openrouter' | 'openai' | 'anthropic' | 'groq';

export interface ProviderConfig {
  id: ProviderId;
  name: string;
  baseUrl: string;
  modelsEndpoint: string;
  chatEndpoint: string;
  // Header customizado para autenticacao (default: Authorization: Bearer)
  authHeader?: string;
  // Headers extras necessarios
  extraHeaders?: Record<string, string>;
  // Alguns provedores tem formato de resposta diferente
  responseFormat?: 'openai' | 'anthropic';
}

export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    modelsEndpoint: '/models',
    chatEndpoint: '/chat/completions',
    responseFormat: 'openai',
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    modelsEndpoint: '/models',
    chatEndpoint: '/chat/completions',
    responseFormat: 'openai',
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    modelsEndpoint: '/models',
    chatEndpoint: '/messages',
    authHeader: 'x-api-key',
    extraHeaders: {
      'anthropic-version': '2023-06-01',
    },
    responseFormat: 'anthropic',
  },
  groq: {
    id: 'groq',
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    modelsEndpoint: '/models',
    chatEndpoint: '/chat/completions',
    responseFormat: 'openai',
  },
} as const;

export const PROVIDER_LIST = Object.values(PROVIDERS);

/**
 * Retorna a configuracao de um provedor pelo ID.
 */
export function getProvider(id: ProviderId): ProviderConfig {
  const provider = PROVIDERS[id];
  if (!provider) {
    throw new Error(`Provider desconhecido: ${id}`);
  }
  return provider;
}

/**
 * Verifica se um ID de provedor é valido.
 */
export function isValidProvider(id: string): id is ProviderId {
  return id in PROVIDERS;
}

/**
 * Interface padronizada para modelo retornado pela API.
 */
export interface ModelInfo {
  id: string;
  name: string;
  contextLength?: number;
  description?: string;
  pricing?: {
    prompt?: string;
    completion?: string;
  };
}

/**
 * Parsea a resposta de modelos de cada provedor para formato padronizado.
 */
export function parseModelsResponse(
  providerId: ProviderId,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  response: any
): ModelInfo[] {
  const models: ModelInfo[] = [];

  switch (providerId) {
    case 'openrouter':
      // OpenRouter retorna { data: [{ id, name, context_length, description, pricing }] }
      if (response.data && Array.isArray(response.data)) {
        for (const m of response.data) {
          // Filtrar modelos que suportam chat
          if (m.architecture?.output_modalities?.includes('text')) {
            models.push({
              id: m.id,
              name: m.name || m.id,
              contextLength: m.context_length,
              description: m.description,
              pricing: m.pricing ? {
                prompt: m.pricing.prompt,
                completion: m.pricing.completion,
              } : undefined,
            });
          }
        }
      }
      break;

    case 'openai':
      // OpenAI retorna { data: [{ id, owned_by, created }] }
      if (response.data && Array.isArray(response.data)) {
        for (const m of response.data) {
          // Filtrar apenas modelos de chat (gpt-*)
          if (m.id.startsWith('gpt-') || m.id.startsWith('o1') || m.id.startsWith('o3')) {
            models.push({
              id: m.id,
              name: m.id,
            });
          }
        }
      }
      break;

    case 'anthropic':
      // Anthropic retorna { data: [{ id, display_name, created_at }] }
      if (response.data && Array.isArray(response.data)) {
        for (const m of response.data) {
          models.push({
            id: m.id,
            name: m.display_name || m.id,
          });
        }
      }
      break;

    case 'groq':
      // Groq retorna { data: [{ id, owned_by, context_window }] }
      if (response.data && Array.isArray(response.data)) {
        for (const m of response.data) {
          // Filtrar modelos ativos e de chat (nao whisper)
          if (m.active !== false && !m.id.includes('whisper') && !m.id.includes('distil')) {
            models.push({
              id: m.id,
              name: m.id,
              contextLength: m.context_window,
            });
          }
        }
      }
      break;
  }

  // Ordenar por nome
  return models.sort((a, b) => a.name.localeCompare(b.name));
}

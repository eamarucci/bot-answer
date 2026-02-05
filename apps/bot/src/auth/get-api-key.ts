import { decrypt } from '@botanswer/crypto';
import { prisma } from '../db/client.js';
import type { ProviderId } from '@botanswer/database';
import type { PermissionResult } from './check-permission.js';
import type { OAuthProvider } from '../llm/oauth-tokens.js';
import { config } from '../config.js';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '';

/**
 * Resultado da busca de API key.
 * Pode ser uma chave API tradicional ou OAuth.
 */
export type ApiKeyResult = ApiKeyResultApi | ApiKeyResultOAuth;

export interface ApiKeyResultApi {
  type: 'api';
  key: string;
  provider: ProviderId;
  model?: string;
  source: 'user' | 'group' | 'admin_default' | 'server_fallback' | 'env_fallback';
}

export interface ApiKeyResultOAuth {
  type: 'oauth';
  adminId: string;
  oauthProvider: OAuthProvider;
  provider: ProviderId;
  model?: string;
  source: 'admin_oauth';
}

/**
 * Busca a chave API correta baseado na hierarquia:
 * 1. Chave do usuario no grupo (apiKeyOverride)
 * 2. Chave do grupo (com provedor configurado)
 * 3. Chave default do admin (com provedor configurado)
 * 4. OAuth do admin (Anthropic ou OpenAI)
 * 5. Chave fallback do servidor (GlobalConfig)
 * 6. Chave do .env (OPENROUTER_API_KEY)
 *
 * Para vision, usa config de vision se disponivel, senao fallback para config de texto.
 *
 * @param permissionResult - Resultado da verificacao de permissao
 * @param isVision - Se é request de vision (imagem/video)
 * @param requestedModel - Modelo solicitado pelo usuario (para determinar provider OAuth)
 * @returns Chave API, provedor, modelo e origem
 */
export async function getApiKey(
  permissionResult: PermissionResult,
  isVision: boolean,
  requestedModel?: string
): Promise<ApiKeyResult | null> {
  const { groupConfig, user, admin } = permissionResult;

  // 1. Chave especifica do usuario no grupo
  if (user?.apiKeyOverride) {
    try {
      const key = decrypt(user.apiKeyOverride, ENCRYPTION_KEY);
      // Usuario nao tem provider proprio, herda do grupo/admin
      let provider: ProviderId;
      let model: string | undefined;

      if (isVision) {
        provider = (groupConfig?.visionProvider || groupConfig?.provider || 
                   admin?.defaultVisionProvider || admin?.defaultProvider || 'openrouter') as ProviderId;
        model = groupConfig?.visionModel || groupConfig?.model !== 'auto' ? groupConfig?.model : 
                admin?.defaultVisionModel || admin?.defaultModel || undefined;
      } else {
        provider = (groupConfig?.provider || admin?.defaultProvider || 'openrouter') as ProviderId;
        model = groupConfig?.model !== 'auto' ? groupConfig?.model : admin?.defaultModel || undefined;
      }

      return { type: 'api', key, provider, model, source: 'user' };
    } catch (error) {
      console.error('Erro ao descriptografar chave do usuario:', error);
    }
  }

  // 2. Chave do grupo (com provedor configurado)
  if (groupConfig) {
    let groupKey: string | null;
    let provider: ProviderId;
    let model: string | undefined;

    if (isVision) {
      // Para vision: usa config de vision se tiver, senao usa config de texto
      groupKey = groupConfig.visionApiKey || groupConfig.apiKey;
      provider = (groupConfig.visionProvider || groupConfig.provider || 'openrouter') as ProviderId;
      model = groupConfig.visionModel || (groupConfig.model !== 'auto' ? groupConfig.model : undefined);
    } else {
      groupKey = groupConfig.apiKey;
      provider = (groupConfig.provider || 'openrouter') as ProviderId;
      model = groupConfig.model !== 'auto' ? groupConfig.model : undefined;
    }

    if (groupKey) {
      try {
        const key = decrypt(groupKey, ENCRYPTION_KEY);
        return { type: 'api', key, provider, model, source: 'group' };
      } catch (error) {
        console.error('Erro ao descriptografar chave do grupo:', error);
      }
    }
  }

  // 3. Chave default do admin (com provedor configurado)
  if (admin) {
    let adminKey: string | null;
    let provider: ProviderId;
    let model: string | undefined;

    if (isVision) {
      // Para vision: usa config de vision se tiver, senao usa config de texto
      adminKey = admin.defaultVisionApiKey || admin.defaultApiKey;
      provider = (admin.defaultVisionProvider || admin.defaultProvider || 'openrouter') as ProviderId;
      model = admin.defaultVisionModel || admin.defaultModel || undefined;
    } else {
      adminKey = admin.defaultApiKey;
      provider = (admin.defaultProvider || 'openrouter') as ProviderId;
      model = admin.defaultModel || undefined;
    }

    if (adminKey) {
      try {
        const key = decrypt(adminKey, ENCRYPTION_KEY);
        return { type: 'api', key, provider, model, source: 'admin_default' };
      } catch (error) {
        console.error('Erro ao descriptografar chave do admin:', error);
      }
    }
  }

  // 4. OAuth do admin (Anthropic ou OpenAI)
  // Verifica se o modelo solicitado é compativel com OAuth disponivel
  if (admin) {
    const oauthResult = getOAuthForAdmin(admin.id, requestedModel, isVision, admin);
    if (oauthResult) {
      return oauthResult;
    }
  }

  // 5. Chave fallback do servidor (GlobalConfig) - sempre OpenRouter
  try {
    const globalConfig = await prisma.globalConfig.findUnique({
      where: { id: 'global' },
    });

    if (globalConfig) {
      const fallbackKey = isVision
        ? globalConfig.fallbackVisionApiKey || globalConfig.fallbackApiKey
        : globalConfig.fallbackApiKey;

      if (fallbackKey) {
        try {
          const key = decrypt(fallbackKey, ENCRYPTION_KEY);
          return { type: 'api', key, provider: 'openrouter', source: 'server_fallback' };
        } catch {
          // Chave pode nao estar criptografada (migrada do .env)
          return { type: 'api', key: fallbackKey, provider: 'openrouter', source: 'server_fallback' };
        }
      }
    }
  } catch (error) {
    console.error('Erro ao buscar GlobalConfig:', error);
  }

  // 6. Chave do .env (fallback final) - sempre OpenRouter
  const envKey = process.env.OPENROUTER_API_KEY;
  if (envKey) {
    return { type: 'api', key: envKey, provider: 'openrouter', source: 'env_fallback' };
  }

  return null;
}

/**
 * Verifica se o admin tem OAuth configurado e se é compativel com o modelo solicitado.
 * Retorna a config OAuth se aplicavel, ou null se nao.
 * 
 * Para vision: Claude e GPT-4o suportam vision nativamente, entao OAuth tem prioridade
 * sobre modelos de vision especificos do OpenRouter.
 */
function getOAuthForAdmin(
  adminId: string,
  requestedModel: string | undefined,
  isVision: boolean,
  adminData: { 
    anthropicOAuthRefresh: string | null;
    anthropicOAuthModel: string | null;
    openaiOAuthRefresh: string | null;
    openaiOAuthModel: string | null;
  }
): ApiKeyResultOAuth | null {
  // Determina qual OAuth usar baseado no modelo solicitado
  
  const modelLower = requestedModel?.toLowerCase() || '';
  
  // Se nao tem modelo especificado OU é um modelo de vision do OpenRouter, considera como "auto"
  // Isso permite que OAuth tenha prioridade para vision (Claude/GPT-4o suportam vision)
  const isOpenRouterVisionModel = modelLower.includes('nvidia') || 
                                   modelLower.includes('nemotron') ||
                                   modelLower.includes('vision');
  const noModelSpecified = !requestedModel || requestedModel === 'auto' || isOpenRouterVisionModel;
  
  // Se o modelo explicitamente pede Anthropic/Claude
  const wantsAnthropic = modelLower.includes('claude') || 
                         modelLower.includes('anthropic') ||
                         modelLower.startsWith('claude-');
  
  // Se o modelo explicitamente pede OpenAI/GPT
  const wantsOpenAI = modelLower.includes('gpt') || 
                      modelLower.includes('openai') ||
                      modelLower.startsWith('gpt-') ||
                      modelLower.startsWith('o1') ||
                      modelLower.startsWith('o3');

  // Tenta Anthropic OAuth primeiro (se disponivel e compativel)
  // Claude suporta vision nativamente, entao funciona para isVision=true
  if (adminData.anthropicOAuthRefresh && (wantsAnthropic || (!wantsOpenAI && noModelSpecified))) {
    // Usa modelo selecionado pelo admin ou default do .env
    const model = adminData.anthropicOAuthModel || config.oauthModels.anthropic;
    
    return {
      type: 'oauth',
      adminId,
      oauthProvider: 'anthropic',
      provider: 'anthropic',
      model,
      source: 'admin_oauth',
    };
  }

  // Tenta OpenAI OAuth (se disponivel e compativel)
  // GPT-4o suporta vision nativamente
  if (adminData.openaiOAuthRefresh && (wantsOpenAI || (!wantsAnthropic && noModelSpecified))) {
    // Usa modelo selecionado pelo admin ou default do .env
    const model = adminData.openaiOAuthModel || config.oauthModels.openai;
    
    return {
      type: 'oauth',
      adminId,
      oauthProvider: 'openai',
      provider: 'openai',
      model,
      source: 'admin_oauth',
    };
  }

  return null;
}

/**
 * Versao simplificada que busca chave sem verificar permissao
 * Util para grupos sem configuracao (fallback)
 */
export async function getApiKeyFallback(
  isVision: boolean
): Promise<ApiKeyResult | null> {
  // Tenta GlobalConfig
  try {
    const globalConfig = await prisma.globalConfig.findUnique({
      where: { id: 'global' },
    });

    if (globalConfig) {
      const fallbackKey = isVision
        ? globalConfig.fallbackVisionApiKey || globalConfig.fallbackApiKey
        : globalConfig.fallbackApiKey;

      if (fallbackKey) {
        try {
          const key = decrypt(fallbackKey, ENCRYPTION_KEY);
          return { type: 'api', key, provider: 'openrouter', source: 'server_fallback' };
        } catch {
          return { type: 'api', key: fallbackKey, provider: 'openrouter', source: 'server_fallback' };
        }
      }
    }
  } catch {
    // Ignora erro, vai pro .env
  }

  // Fallback final: .env
  const envKey = process.env.OPENROUTER_API_KEY;
  if (envKey) {
    return { type: 'api', key: envKey, provider: 'openrouter', source: 'env_fallback' };
  }

  return null;
}

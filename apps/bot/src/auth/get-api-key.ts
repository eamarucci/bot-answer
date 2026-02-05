import { decrypt } from '@botanswer/crypto';
import { prisma } from '../db/client.js';
import type { PermissionResult } from './check-permission.js';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '';

export interface ApiKeyResult {
  key: string;
  source: 'user' | 'group' | 'admin_default' | 'server_fallback' | 'env_fallback';
}

/**
 * Busca a chave API correta baseado na hierarquia:
 * 1. Chave do usuario no grupo (apiKeyOverride)
 * 2. Chave do grupo
 * 3. Chave default do admin
 * 4. Chave fallback do servidor (GlobalConfig)
 * 5. Chave do .env (OPENROUTER_API_KEY)
 *
 * @param permissionResult - Resultado da verificacao de permissao
 * @param isVision - Se é request de vision (imagem/video)
 * @returns Chave API e sua origem
 */
export async function getApiKey(
  permissionResult: PermissionResult,
  isVision: boolean
): Promise<ApiKeyResult | null> {
  const { groupConfig, user, admin } = permissionResult;

  // 1. Chave especifica do usuario no grupo
  if (user?.apiKeyOverride) {
    try {
      const key = decrypt(user.apiKeyOverride, ENCRYPTION_KEY);
      return { key, source: 'user' };
    } catch (error) {
      console.error('Erro ao descriptografar chave do usuario:', error);
    }
  }

  // 2. Chave do grupo
  if (groupConfig) {
    const groupKey = isVision
      ? groupConfig.visionApiKey || groupConfig.apiKey
      : groupConfig.apiKey;

    if (groupKey) {
      try {
        const key = decrypt(groupKey, ENCRYPTION_KEY);
        return { key, source: 'group' };
      } catch (error) {
        console.error('Erro ao descriptografar chave do grupo:', error);
      }
    }
  }

  // 3. Chave default do admin
  if (admin) {
    const adminKey = isVision
      ? admin.defaultVisionApiKey || admin.defaultApiKey
      : admin.defaultApiKey;

    if (adminKey) {
      try {
        const key = decrypt(adminKey, ENCRYPTION_KEY);
        return { key, source: 'admin_default' };
      } catch (error) {
        console.error('Erro ao descriptografar chave do admin:', error);
      }
    }
  }

  // 4. Chave fallback do servidor (GlobalConfig)
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
          return { key, source: 'server_fallback' };
        } catch {
          // Chave pode nao estar criptografada (migrada do .env)
          return { key: fallbackKey, source: 'server_fallback' };
        }
      }
    }
  } catch (error) {
    console.error('Erro ao buscar GlobalConfig:', error);
  }

  // 5. Chave do .env (fallback final)
  const envKey = process.env.OPENROUTER_API_KEY;
  if (envKey) {
    return { key: envKey, source: 'env_fallback' };
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
          return { key, source: 'server_fallback' };
        } catch {
          return { key: fallbackKey, source: 'server_fallback' };
        }
      }
    }
  } catch {
    // Ignora erro, vai pro .env
  }

  // Fallback final: .env
  const envKey = process.env.OPENROUTER_API_KEY;
  if (envKey) {
    return { key: envKey, source: 'env_fallback' };
  }

  return null;
}

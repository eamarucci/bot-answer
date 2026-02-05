/**
 * Gerenciador de tokens OAuth em memoria
 * 
 * Cache de access tokens por adminId + provider.
 * O refresh token é armazenado criptografado no banco.
 * O access token é gerado on-demand e cacheado em memoria.
 */

import { decrypt, encrypt } from '@botanswer/crypto';
import { prisma } from '../db/client.js';
import { logger } from '../utils/logger.js';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '';

// Constantes OAuth Anthropic (mesmas usadas pelo OpenCode)
const ANTHROPIC_CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';
const ANTHROPIC_TOKEN_URL = 'https://console.anthropic.com/v1/oauth/token';

// Cache de access tokens em memoria
// Chave: `${adminId}:${provider}`
interface CachedToken {
  accessToken: string;
  expiresAt: Date;
}

const tokenCache = new Map<string, CachedToken>();

// Margem de seguranca: renovar token 5 minutos antes de expirar
const EXPIRY_MARGIN_MS = 5 * 60 * 1000;

export type OAuthProvider = 'anthropic' | 'openai';

export type OAuthTokenResult = 
  | { success: true; accessToken: string; provider: OAuthProvider }
  | { success: false; error: string };

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

/**
 * Obtem access token OAuth para um admin.
 * Se o token estiver em cache e valido, retorna do cache.
 * Senao, faz refresh usando o refresh token do banco.
 */
export async function getOAuthAccessToken(
  adminId: string,
  provider: OAuthProvider
): Promise<OAuthTokenResult> {
  const cacheKey = `${adminId}:${provider}`;
  
  // Verifica cache
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt.getTime() > Date.now() + EXPIRY_MARGIN_MS) {
    logger.debug('OAuth token found in cache', { adminId, provider });
    return {
      success: true,
      accessToken: cached.accessToken,
      provider,
    };
  }

  // Busca refresh token do banco
  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
    select: {
      anthropicOAuthRefresh: true,
      anthropicOAuthExpires: true,
      openaiOAuthRefresh: true,
      openaiOAuthExpires: true,
      openaiOAuthAccountId: true,
    },
  });

  if (!admin) {
    return { success: false, error: 'Admin nao encontrado' };
  }

  // Seleciona campos baseado no provider
  let encryptedRefresh: string | null;
  let refreshExpires: Date | null;

  if (provider === 'anthropic') {
    encryptedRefresh = admin.anthropicOAuthRefresh;
    refreshExpires = admin.anthropicOAuthExpires;
  } else {
    encryptedRefresh = admin.openaiOAuthRefresh;
    refreshExpires = admin.openaiOAuthExpires;
  }

  if (!encryptedRefresh) {
    return { success: false, error: `OAuth ${provider} nao configurado` };
  }

  // Verifica se refresh token expirou (se tiver data de expiracao)
  if (refreshExpires && refreshExpires.getTime() < Date.now()) {
    // Limpa OAuth do banco
    await clearOAuthForAdmin(adminId, provider);
    return { success: false, error: `OAuth ${provider} expirado. Reconecte na web.` };
  }

  // Descriptografa refresh token
  let refreshToken: string;
  try {
    refreshToken = decrypt(encryptedRefresh, ENCRYPTION_KEY);
  } catch (error) {
    logger.error('Erro ao descriptografar refresh token OAuth', { adminId, provider, error });
    return { success: false, error: 'Erro ao descriptografar token OAuth' };
  }

  // Faz refresh do token
  const refreshResult = await refreshOAuthToken(refreshToken, provider);
  
  if (!refreshResult.success) {
    // Se refresh falhou, pode ser que o token foi revogado
    // Limpa OAuth do banco para forcar reconexao
    await clearOAuthForAdmin(adminId, provider);
    return refreshResult;
  }

  // Atualiza cache
  tokenCache.set(cacheKey, {
    accessToken: refreshResult.accessToken,
    expiresAt: refreshResult.expiresAt,
  });

  // Atualiza refresh token no banco (pode ter mudado)
  await updateRefreshToken(adminId, provider, refreshResult.newRefreshToken, refreshResult.expiresAt);

  logger.info('OAuth token refreshed successfully', { adminId, provider });

  return {
    success: true,
    accessToken: refreshResult.accessToken,
    provider,
  };
}

interface RefreshSuccess {
  success: true;
  accessToken: string;
  newRefreshToken: string;
  expiresAt: Date;
}

interface RefreshError {
  success: false;
  error: string;
}

type RefreshResult = RefreshSuccess | RefreshError;

/**
 * Faz refresh do access token usando refresh token
 */
async function refreshOAuthToken(
  refreshToken: string,
  provider: OAuthProvider
): Promise<RefreshResult> {
  if (provider === 'anthropic') {
    return refreshAnthropicToken(refreshToken);
  } else {
    return refreshOpenAIToken(refreshToken);
  }
}

/**
 * Refresh token Anthropic
 */
async function refreshAnthropicToken(refreshToken: string): Promise<RefreshResult> {
  try {
    const response = await fetch(ANTHROPIC_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: ANTHROPIC_CLIENT_ID,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Anthropic token refresh failed', { status: response.status, error: errorText });
      return {
        success: false,
        error: `Falha ao renovar token Anthropic: ${response.status}`,
      };
    }

    const data = await response.json() as TokenResponse;

    return {
      success: true,
      accessToken: data.access_token,
      newRefreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  } catch (error) {
    logger.error('Anthropic token refresh error', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

/**
 * Refresh token OpenAI (Device Flow)
 * TODO: Implementar na Fase 2
 */
async function refreshOpenAIToken(_refreshToken: string): Promise<RefreshResult> {
  return {
    success: false,
    error: 'OAuth OpenAI ainda nao implementado',
  };
}

/**
 * Atualiza refresh token no banco
 */
async function updateRefreshToken(
  adminId: string,
  provider: OAuthProvider,
  newRefreshToken: string,
  expiresAt: Date
): Promise<void> {
  try {
    const encryptedRefresh = encrypt(newRefreshToken, ENCRYPTION_KEY);

    if (provider === 'anthropic') {
      await prisma.admin.update({
        where: { id: adminId },
        data: {
          anthropicOAuthRefresh: encryptedRefresh,
          anthropicOAuthExpires: expiresAt,
        },
      });
    } else {
      await prisma.admin.update({
        where: { id: adminId },
        data: {
          openaiOAuthRefresh: encryptedRefresh,
          openaiOAuthExpires: expiresAt,
        },
      });
    }
  } catch (error) {
    logger.error('Erro ao atualizar refresh token no banco', { adminId, provider, error });
  }
}

/**
 * Limpa OAuth de um admin (usado quando token é revogado ou expirado)
 */
async function clearOAuthForAdmin(adminId: string, provider: OAuthProvider): Promise<void> {
  try {
    const cacheKey = `${adminId}:${provider}`;
    tokenCache.delete(cacheKey);

    if (provider === 'anthropic') {
      await prisma.admin.update({
        where: { id: adminId },
        data: {
          anthropicOAuthRefresh: null,
          anthropicOAuthExpires: null,
        },
      });
    } else {
      await prisma.admin.update({
        where: { id: adminId },
        data: {
          openaiOAuthRefresh: null,
          openaiOAuthExpires: null,
          openaiOAuthAccountId: null,
        },
      });
    }

    logger.info('OAuth cleared for admin', { adminId, provider });
  } catch (error) {
    logger.error('Erro ao limpar OAuth do admin', { adminId, provider, error });
  }
}

/**
 * Verifica se um admin tem OAuth configurado para um provider
 */
export async function hasOAuthConfigured(
  adminId: string,
  provider: OAuthProvider
): Promise<boolean> {
  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
    select: {
      anthropicOAuthRefresh: true,
      openaiOAuthRefresh: true,
    },
  });

  if (!admin) return false;

  if (provider === 'anthropic') {
    return !!admin.anthropicOAuthRefresh;
  } else {
    return !!admin.openaiOAuthRefresh;
  }
}

/**
 * Invalida cache de um admin (usado quando admin desconecta OAuth na web)
 */
export function invalidateCache(adminId: string, provider?: OAuthProvider): void {
  if (provider) {
    const cacheKey = `${adminId}:${provider}`;
    tokenCache.delete(cacheKey);
  } else {
    // Invalida todos os providers
    tokenCache.delete(`${adminId}:anthropic`);
    tokenCache.delete(`${adminId}:openai`);
  }
}

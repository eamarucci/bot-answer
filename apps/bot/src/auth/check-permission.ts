import { prisma } from '../db/client.js';
import { getRelayPhoneForRoom } from './resolve-phone.js';

/**
 * Busca a config do grupo pelo roomId (sem verificar permissao de usuario)
 * Usado quando nao conseguimos identificar o usuario (ex: usuario Matrix nativo)
 * 
 * Se o grupo nao tem config mas tem relay no Mautrix, cria automaticamente.
 */
export async function getGroupConfigByRoomId(roomId: string): Promise<PermissionResult> {
  let groupConfig = await prisma.groupConfig.findUnique({
    where: { matrixRoomId: roomId },
    include: {
      admin: true,
    },
  });

  // Se nao tem config, tenta criar automaticamente baseado no relay do Mautrix
  if (!groupConfig) {
    const relayPhone = await getRelayPhoneForRoom(roomId);
    
    if (relayPhone) {
      // Busca ou cria o admin pelo telefone
      const admin = await prisma.admin.upsert({
        where: { phoneNumber: relayPhone },
        update: {},
        create: { phoneNumber: relayPhone },
      });

      // Cria a config do grupo
      groupConfig = await prisma.groupConfig.create({
        data: {
          matrixRoomId: roomId,
          adminId: admin.id,
          model: 'auto',
          allowAll: true,
        },
        include: {
          admin: true,
        },
      });

      console.log(`GroupConfig criado automaticamente para ${roomId} com admin ${relayPhone}`);
    }
  }

  if (!groupConfig) {
    return {
      allowed: true,
      reason: 'Grupo sem configuracao e sem relay, usando fallback',
    };
  }

  if (!groupConfig.isActive) {
    return {
      allowed: false,
      reason: 'Bot desativado neste grupo pelo admin.',
    };
  }

  return {
    allowed: true,
    groupConfig: {
      id: groupConfig.id,
      adminId: groupConfig.adminId,
      provider: groupConfig.provider,
      model: groupConfig.model,
      apiKey: groupConfig.apiKey,
      visionProvider: groupConfig.visionProvider,
      visionModel: groupConfig.visionModel,
      visionApiKey: groupConfig.visionApiKey,
      systemPrompt: groupConfig.systemPrompt,
      allowAll: groupConfig.allowAll,
    },
    admin: {
      id: groupConfig.admin.id,
      defaultProvider: groupConfig.admin.defaultProvider,
      defaultModel: groupConfig.admin.defaultModel,
      defaultApiKey: groupConfig.admin.defaultApiKey,
      defaultVisionProvider: groupConfig.admin.defaultVisionProvider,
      defaultVisionModel: groupConfig.admin.defaultVisionModel,
      defaultVisionApiKey: groupConfig.admin.defaultVisionApiKey,
      anthropicOAuthRefresh: groupConfig.admin.anthropicOAuthRefresh,
      anthropicOAuthModel: groupConfig.admin.anthropicOAuthModel,
      openaiOAuthRefresh: groupConfig.admin.openaiOAuthRefresh,
      openaiOAuthModel: groupConfig.admin.openaiOAuthModel,
    },
  };
}

export interface PermissionResult {
  allowed: boolean;
  reason?: string;
  groupConfig?: {
    id: string;
    adminId: string;
    // Texto
    provider: string | null;
    model: string;
    apiKey: string | null;
    // Vision
    visionProvider: string | null;
    visionModel: string | null;
    visionApiKey: string | null;
    // Outros
    systemPrompt: string | null;
    allowAll: boolean;
  };
  user?: {
    id: string;
    apiKeyOverride: string | null;
  };
  admin?: {
    id: string;
    // Texto
    defaultProvider: string | null;
    defaultModel: string | null;
    defaultApiKey: string | null;
    // Vision
    defaultVisionProvider: string | null;
    defaultVisionModel: string | null;
    defaultVisionApiKey: string | null;
    // OAuth
    anthropicOAuthRefresh: string | null;
    anthropicOAuthModel: string | null;
    openaiOAuthRefresh: string | null;
    openaiOAuthModel: string | null;
  };
}

/**
 * Verifica se o usuario tem permissao para usar o bot no grupo
 *
 * @param roomId - Matrix room ID
 * @param phoneNumber - Numero de telefone do usuario
 * @returns Resultado da verificacao com dados para buscar chave API
 */
export async function checkPermission(
  roomId: string,
  phoneNumber: string
): Promise<PermissionResult> {
  // Busca config do grupo
  const groupConfig = await prisma.groupConfig.findUnique({
    where: { matrixRoomId: roomId },
    include: {
      admin: true,
    },
  });

  // Se grupo nao tem config, permite (usara fallback)
  if (!groupConfig) {
    return {
      allowed: true,
      reason: 'Grupo sem configuracao, usando fallback',
    };
  }

  // Se grupo esta desativado
  if (!groupConfig.isActive) {
    return {
      allowed: false,
      reason: 'Bot desativado neste grupo pelo admin.',
    };
  }

  // Se allowAll = true, todos podem usar
  if (groupConfig.allowAll) {
    return {
      allowed: true,
      groupConfig: {
        id: groupConfig.id,
        adminId: groupConfig.adminId,
        provider: groupConfig.provider,
        model: groupConfig.model,
        apiKey: groupConfig.apiKey,
        visionProvider: groupConfig.visionProvider,
        visionModel: groupConfig.visionModel,
        visionApiKey: groupConfig.visionApiKey,
        systemPrompt: groupConfig.systemPrompt,
        allowAll: groupConfig.allowAll,
      },
      admin: {
        id: groupConfig.admin.id,
        defaultProvider: groupConfig.admin.defaultProvider,
        defaultModel: groupConfig.admin.defaultModel,
        defaultApiKey: groupConfig.admin.defaultApiKey,
        defaultVisionProvider: groupConfig.admin.defaultVisionProvider,
        defaultVisionModel: groupConfig.admin.defaultVisionModel,
        defaultVisionApiKey: groupConfig.admin.defaultVisionApiKey,
        anthropicOAuthRefresh: groupConfig.admin.anthropicOAuthRefresh,
        anthropicOAuthModel: groupConfig.admin.anthropicOAuthModel,
        openaiOAuthRefresh: groupConfig.admin.openaiOAuthRefresh,
        openaiOAuthModel: groupConfig.admin.openaiOAuthModel,
      },
    };
  }

  // Verifica se usuario esta na lista de permitidos
  const user = await prisma.user.findUnique({
    where: {
      phoneNumber_groupConfigId: {
        phoneNumber,
        groupConfigId: groupConfig.id,
      },
    },
  });

  if (!user) {
    return {
      allowed: false,
      reason:
        'Voce nao esta habilitado para usar o bot neste grupo. Peca ao admin para te adicionar.',
    };
  }

  if (!user.isEnabled) {
    return {
      allowed: false,
      reason: 'Seu acesso ao bot neste grupo foi desativado.',
    };
  }

  return {
    allowed: true,
    groupConfig: {
      id: groupConfig.id,
      adminId: groupConfig.adminId,
      provider: groupConfig.provider,
      model: groupConfig.model,
      apiKey: groupConfig.apiKey,
      visionProvider: groupConfig.visionProvider,
      visionModel: groupConfig.visionModel,
      visionApiKey: groupConfig.visionApiKey,
      systemPrompt: groupConfig.systemPrompt,
      allowAll: groupConfig.allowAll,
    },
    user: {
      id: user.id,
      apiKeyOverride: user.apiKeyOverride,
    },
    admin: {
      id: groupConfig.admin.id,
      defaultProvider: groupConfig.admin.defaultProvider,
      defaultModel: groupConfig.admin.defaultModel,
      defaultApiKey: groupConfig.admin.defaultApiKey,
      defaultVisionProvider: groupConfig.admin.defaultVisionProvider,
      defaultVisionModel: groupConfig.admin.defaultVisionModel,
      defaultVisionApiKey: groupConfig.admin.defaultVisionApiKey,
      anthropicOAuthRefresh: groupConfig.admin.anthropicOAuthRefresh,
      anthropicOAuthModel: groupConfig.admin.anthropicOAuthModel,
      openaiOAuthRefresh: groupConfig.admin.openaiOAuthRefresh,
      openaiOAuthModel: groupConfig.admin.openaiOAuthModel,
    },
  };
}

import { prisma } from '../db/client.js';

export interface PermissionResult {
  allowed: boolean;
  reason?: string;
  groupConfig?: {
    id: string;
    adminId: string;
    apiKey: string | null;
    visionApiKey: string | null;
    model: string;
    systemPrompt: string | null;
    allowAll: boolean;
  };
  user?: {
    id: string;
    apiKeyOverride: string | null;
  };
  admin?: {
    id: string;
    defaultApiKey: string | null;
    defaultVisionApiKey: string | null;
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
        apiKey: groupConfig.apiKey,
        visionApiKey: groupConfig.visionApiKey,
        model: groupConfig.model,
        systemPrompt: groupConfig.systemPrompt,
        allowAll: groupConfig.allowAll,
      },
      admin: {
        id: groupConfig.admin.id,
        defaultApiKey: groupConfig.admin.defaultApiKey,
        defaultVisionApiKey: groupConfig.admin.defaultVisionApiKey,
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
      apiKey: groupConfig.apiKey,
      visionApiKey: groupConfig.visionApiKey,
      model: groupConfig.model,
      systemPrompt: groupConfig.systemPrompt,
      allowAll: groupConfig.allowAll,
    },
    user: {
      id: user.id,
      apiKeyOverride: user.apiKeyOverride,
    },
    admin: {
      id: groupConfig.admin.id,
      defaultApiKey: groupConfig.admin.defaultApiKey,
      defaultVisionApiKey: groupConfig.admin.defaultVisionApiKey,
    },
  };
}

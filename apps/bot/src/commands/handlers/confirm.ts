import { Pool } from 'pg';
import { prisma } from '../../db/client.js';
import { resolvePhoneFromSender } from '../../auth/resolve-phone.js';
import { logger } from '../../utils/logger.js';

const mautrixPool = new Pool({
  connectionString: process.env.MAUTRIX_DATABASE_URL,
});

interface Portal {
  mxid: string;
  relay_login_id: string | null;
}

/**
 * Busca info do portal pelo mxid
 */
async function getPortalByMxid(mxid: string): Promise<Portal | null> {
  const result = await mautrixPool.query<Portal>(
    `
    SELECT mxid, relay_login_id
    FROM portal 
    WHERE mxid = $1
  `,
    [mxid]
  );

  return result.rows[0] || null;
}

export interface ConfirmResult {
  success: boolean;
  message: string;
}

/**
 * Handler para o comando -confirmar
 * Verifica se o sender é o relay do grupo e confirma o código de autenticação
 */
export async function handleConfirm(
  roomId: string,
  code: string,
  sender: string
): Promise<ConfirmResult> {
  if (!code || code.length !== 6 || !/^\d+$/.test(code)) {
    return {
      success: false,
      message: 'Codigo invalido. Use: /ia -confirmar CODIGO (6 digitos)',
    };
  }

  // Resolve o numero de telefone do sender
  const senderPhone = await resolvePhoneFromSender(sender);
  
  if (!senderPhone) {
    return {
      success: false,
      message: 'Nao foi possivel identificar seu numero de telefone.',
    };
  }

  logger.debug('Confirm command', { roomId, code, sender, senderPhone });

  // Busca info do portal/grupo no mautrix
  const portal = await getPortalByMxid(roomId);
  
  if (!portal) {
    return {
      success: false,
      message: 'Este grupo nao foi encontrado no sistema.',
    };
  }

  // Verifica se o sender é o relay deste grupo
  if (portal.relay_login_id !== senderPhone) {
    return {
      success: false,
      message: 'Apenas o relay do grupo pode confirmar codigos de autenticacao.',
    };
  }

  // Busca o codigo de autenticacao pendente para este numero
  const authCode = await prisma.authCode.findFirst({
    where: {
      phoneNumber: senderPhone,
      code,
      confirmedAt: null,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  if (!authCode) {
    return {
      success: false,
      message: 'Codigo invalido, expirado ou ja utilizado.',
    };
  }

  // Confirma o codigo
  await prisma.authCode.update({
    where: { id: authCode.id },
    data: { confirmedAt: new Date() },
  });

  logger.info('Auth code confirmed', { 
    phoneNumber: senderPhone, 
    code,
    roomId,
  });

  return {
    success: true,
    message: 'Codigo confirmado com sucesso! Volte para a pagina de login.',
  };
}

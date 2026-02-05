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
  logger.info('Confirm command received', { roomId, code, sender });

  if (!code || code.length !== 6 || !/^\d+$/.test(code)) {
    return {
      success: false,
      message: 'Codigo invalido. Use: /ia -confirmar CODIGO (6 digitos)',
    };
  }

  // Resolve o numero de telefone do sender
  const senderPhone = await resolvePhoneFromSender(sender);
  
  // Busca info do portal/grupo no mautrix
  const portal = await getPortalByMxid(roomId);
  
  logger.info('Portal info', { roomId, portal });

  if (!portal) {
    return {
      success: false,
      message: 'Este grupo nao foi encontrado no sistema.',
    };
  }

  // Verifica se o sender é o relay deste grupo
  // O senderPhone pode ser null se a mensagem vier via relay (o proprio relay enviando)
  // Nesse caso, confiamos que quem está no grupo com relay configurado é o dono
  const relayPhone = portal.relay_login_id;
  
  logger.info('Checking relay', { senderPhone, relayPhone });

  // Se conseguimos resolver o telefone do sender, verifica se bate com o relay
  if (senderPhone && relayPhone && senderPhone !== relayPhone) {
    return {
      success: false,
      message: 'Apenas o relay do grupo pode confirmar codigos de autenticacao.',
    };
  }

  // Usa o telefone do relay do grupo para buscar o codigo
  const phoneToCheck = senderPhone || relayPhone;
  
  if (!phoneToCheck) {
    return {
      success: false,
      message: 'Nao foi possivel identificar o numero de telefone do relay.',
    };
  }

  // Busca o codigo de autenticacao pendente para este numero
  const authCode = await prisma.authCode.findFirst({
    where: {
      phoneNumber: phoneToCheck,
      code,
      confirmedAt: null,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  logger.info('Auth code lookup', { phoneToCheck, code, found: !!authCode });

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
    phoneNumber: phoneToCheck, 
    code,
    roomId,
  });

  return {
    success: true,
    message: 'Codigo confirmado com sucesso! Volte para a pagina de login.',
  };
}

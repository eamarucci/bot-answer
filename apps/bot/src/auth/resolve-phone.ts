import { Pool } from 'pg';

const mautrixPool = new Pool({
  connectionString: process.env.MAUTRIX_DATABASE_URL,
});

/**
 * Extrai o ghost ID do sender Matrix
 *
 * @param sender - Matrix user ID (ex: "@whatsapp_5512996732387:matrix.marucci.cloud")
 * @returns Ghost ID (ex: "5512996732387" ou "lid-275071264403599")
 */
export function extractGhostId(sender: string): string | null {
  // Formato: @whatsapp_<ghostId>:<server>
  const match = sender.match(/^@whatsapp_([^:]+):/);
  return match ? match[1] : null;
}

/**
 * Resolve ghost ID para numero de telefone real via banco do mautrix
 * Funciona tanto para IDs numericos quanto para LIDs
 *
 * @param ghostId - ID do ghost (ex: "5512996732387" ou "lid-275071264403599")
 * @returns Numero de telefone (ex: "5512996732387") ou null
 */
export async function resolvePhoneFromGhost(
  ghostId: string
): Promise<string | null> {
  try {
    const result = await mautrixPool.query<{ identifiers: string[] }>(
      `
      SELECT identifiers 
      FROM ghost 
      WHERE id = $1
    `,
      [ghostId]
    );

    if (result.rows.length === 0) {
      // Se nao encontrou no banco, tenta extrair do proprio ID
      // Formato numerico: "5512996732387" -> retorna direto
      if (/^\d+$/.test(ghostId)) {
        return ghostId;
      }
      return null;
    }

    const identifiers = result.rows[0].identifiers;

    // Procura por identifier de telefone (ex: "tel:+5512996732387")
    for (const identifier of identifiers || []) {
      if (identifier.startsWith('tel:')) {
        // Remove "tel:+" e retorna so o numero
        return identifier.replace('tel:+', '');
      }
    }

    // Se nao tem telefone nos identifiers mas o ghostId é numerico
    if (/^\d+$/.test(ghostId)) {
      return ghostId;
    }

    return null;
  } catch (error) {
    console.error('Erro ao resolver telefone do ghost:', error);
    // Fallback: se o ghostId é numerico, usa ele
    if (/^\d+$/.test(ghostId)) {
      return ghostId;
    }
    return null;
  }
}

/**
 * Resolve sender Matrix para numero de telefone
 * Combina extractGhostId + resolvePhoneFromGhost
 *
 * @param sender - Matrix user ID
 * @returns Numero de telefone ou null
 */
export async function resolvePhoneFromSender(
  sender: string
): Promise<string | null> {
  const ghostId = extractGhostId(sender);
  if (!ghostId) {
    return null;
  }
  return resolvePhoneFromGhost(ghostId);
}

/**
 * Busca o numero de telefone do relay de um grupo no banco do Mautrix
 *
 * @param roomId - Matrix room ID (ex: "!abc123:matrix.server.com")
 * @returns Numero de telefone do relay ou null
 */
export async function getRelayPhoneForRoom(
  roomId: string
): Promise<string | null> {
  try {
    const result = await mautrixPool.query<{ relay_login_id: string }>(
      `
      SELECT relay_login_id 
      FROM portal 
      WHERE mxid = $1 AND relay_login_id IS NOT NULL
      `,
      [roomId]
    );

    if (result.rows.length === 0 || !result.rows[0].relay_login_id) {
      return null;
    }

    const relayLoginId = result.rows[0].relay_login_id;
    
    // relay_login_id já é o número de telefone (ex: "551231974530")
    // Se for numérico, retorna direto
    if (/^\d+$/.test(relayLoginId)) {
      return relayLoginId;
    }
    
    // Senão tenta resolver como ghost
    return resolvePhoneFromGhost(relayLoginId);
  } catch (error) {
    console.error('Erro ao buscar relay do grupo:', error);
    return null;
  }
}

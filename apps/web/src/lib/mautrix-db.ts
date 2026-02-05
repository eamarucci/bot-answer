import { Pool } from 'pg';

const mautrixPool = new Pool({
  connectionString: process.env.MAUTRIX_DATABASE_URL,
});

export interface Portal {
  mxid: string;
  name: string | null;
  relay_login_id: string | null;
}

/**
 * Busca grupos onde o numero é relay
 */
export async function getGroupsByRelay(relayNumber: string): Promise<Portal[]> {
  const result = await mautrixPool.query<Portal>(
    `
    SELECT mxid, name, relay_login_id
    FROM portal 
    WHERE relay_login_id = $1 
    AND mxid IS NOT NULL
    ORDER BY name
  `,
    [relayNumber]
  );

  return result.rows;
}

/**
 * Verifica se numero é relay de algum grupo
 */
export async function isRelay(phoneNumber: string): Promise<boolean> {
  const result = await mautrixPool.query<{ count: string }>(
    `
    SELECT COUNT(*) as count 
    FROM portal 
    WHERE relay_login_id = $1
  `,
    [phoneNumber]
  );

  return parseInt(result.rows[0].count) > 0;
}

/**
 * Busca info do portal pelo mxid
 */
export async function getPortalByMxid(mxid: string): Promise<Portal | null> {
  const result = await mautrixPool.query<Portal>(
    `
    SELECT mxid, name, relay_login_id
    FROM portal 
    WHERE mxid = $1
  `,
    [mxid]
  );

  return result.rows[0] || null;
}

/**
 * Resolve ghost ID para numero de telefone real
 * Funciona tanto para IDs numericos quanto para LIDs
 */
export async function resolvePhoneFromGhost(
  ghostId: string
): Promise<string | null> {
  const result = await mautrixPool.query<{ identifiers: string[] }>(
    `
    SELECT identifiers 
    FROM ghost 
    WHERE id = $1
  `,
    [ghostId]
  );

  if (result.rows.length === 0) {
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

  return null;
}

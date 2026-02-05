/**
 * PKCE (Proof Key for Code Exchange) helper
 * Usa a mesma implementacao do OpenCode via @openauthjs/openauth
 */

import { generatePKCE as generatePKCEFromLib } from '@openauthjs/openauth/pkce';

export interface PKCEChallenge {
  verifier: string;
  challenge: string;
  method: string;
}

/**
 * Gera um par PKCE (verifier + challenge) para OAuth
 */
export async function generatePKCE(): Promise<PKCEChallenge> {
  const pkce = await generatePKCEFromLib();
  return {
    verifier: pkce.verifier,
    challenge: pkce.challenge,
    method: pkce.method,
  };
}

/**
 * OAuth Anthropic (Claude Pro/Max)
 * Baseado na implementacao do OpenCode (opencode-anthropic-auth)
 */

import { generatePKCE, type PKCEChallenge } from './pkce';

// Constantes do OAuth Anthropic (mesmo CLIENT_ID usado pelo OpenCode)
const CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';
const REDIRECT_URI = 'https://console.anthropic.com/oauth/code/callback';
const TOKEN_URL = 'https://console.anthropic.com/v1/oauth/token';

export interface AuthorizeResult {
  url: string;
  verifier: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export type ExchangeResult = 
  | { success: true; accessToken: string; refreshToken: string; expiresAt: Date }
  | { success: false; error: string };

export type RefreshResult = 
  | { success: true; accessToken: string; refreshToken: string; expiresAt: Date }
  | { success: false; error: string };

/**
 * Gera URL de autorizacao para Claude Pro/Max
 * O usuario sera redirecionado para claude.ai para fazer login
 */
export async function authorize(): Promise<AuthorizeResult> {
  const pkce = await generatePKCE();

  const url = new URL('https://claude.ai/oauth/authorize');
  url.searchParams.set('code', 'true');
  url.searchParams.set('client_id', CLIENT_ID);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', REDIRECT_URI);
  url.searchParams.set('scope', 'org:create_api_key user:profile user:inference');
  url.searchParams.set('code_challenge', pkce.challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', pkce.verifier);

  return {
    url: url.toString(),
    verifier: pkce.verifier,
  };
}

/**
 * Troca o codigo de autorizacao por tokens
 * O codigo vem no formato "code#state" da pagina de callback do Anthropic
 */
export async function exchange(code: string, verifier: string): Promise<ExchangeResult> {
  try {
    // O codigo pode vir no formato "code#state"
    const splits = code.split('#');
    const authCode = splits[0];
    const state = splits[1] || verifier;

    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: authCode,
        state: state,
        grant_type: 'authorization_code',
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        code_verifier: verifier,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic token exchange failed:', response.status, errorText);
      return {
        success: false,
        error: `Falha na autorizacao: ${response.status}`,
      };
    }

    const data = await response.json() as TokenResponse;

    return {
      success: true,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  } catch (error) {
    console.error('Anthropic token exchange error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

/**
 * Atualiza o access token usando o refresh token
 */
export async function refresh(refreshToken: string): Promise<RefreshResult> {
  try {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: CLIENT_ID,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic token refresh failed:', response.status, errorText);
      return {
        success: false,
        error: `Falha ao renovar token: ${response.status}`,
      };
    }

    const data = await response.json() as TokenResponse;

    return {
      success: true,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  } catch (error) {
    console.error('Anthropic token refresh error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

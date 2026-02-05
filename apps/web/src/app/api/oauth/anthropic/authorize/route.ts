import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { authorize } from '@/lib/oauth/anthropic';

/**
 * POST /api/oauth/anthropic/authorize
 * 
 * Inicia o fluxo OAuth do Anthropic (Claude Pro/Max)
 * Retorna a URL de autorizacao e armazena o verifier em cookie
 */
export async function POST() {
  try {
    // Gera URL de autorizacao com PKCE
    const result = await authorize();

    // Armazena o verifier em cookie HTTPOnly (expira em 10 minutos)
    const cookieStore = await cookies();
    cookieStore.set('anthropic_oauth_verifier', result.verifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutos
      path: '/',
    });

    return NextResponse.json({
      success: true,
      url: result.url,
    });
  } catch (error) {
    console.error('Error starting Anthropic OAuth:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao iniciar autorizacao' },
      { status: 500 }
    );
  }
}

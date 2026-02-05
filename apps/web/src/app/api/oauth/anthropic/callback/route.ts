import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSession } from '@/lib/auth';
import { exchange } from '@/lib/oauth/anthropic';
import { encrypt } from '@botanswer/crypto';
import { prisma } from '@/lib/db';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '';

/**
 * POST /api/oauth/anthropic/callback
 * 
 * Recebe o codigo de autorizacao do usuario e troca por tokens
 * Body: { code: string }
 */
export async function POST(request: NextRequest) {
  try {
    // Verifica se usuario esta logado
    const session = await getSession();
    if (!session?.adminId) {
      return NextResponse.json(
        { success: false, error: 'Nao autenticado' },
        { status: 401 }
      );
    }

    // Pega o verifier do cookie
    const cookieStore = await cookies();
    const verifier = cookieStore.get('anthropic_oauth_verifier')?.value;

    if (!verifier) {
      return NextResponse.json(
        { success: false, error: 'Sessao de autorizacao expirada. Tente novamente.' },
        { status: 400 }
      );
    }

    // Pega o codigo do body
    const body = await request.json();
    const { code } = body;

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Codigo de autorizacao invalido' },
        { status: 400 }
      );
    }

    // Troca codigo por tokens
    const result = await exchange(code, verifier);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    // Criptografa o refresh token
    const encryptedRefreshToken = encrypt(result.refreshToken, ENCRYPTION_KEY);

    // Salva no banco
    await prisma.admin.update({
      where: { id: session.adminId },
      data: {
        anthropicOAuthRefresh: encryptedRefreshToken,
        anthropicOAuthExpires: result.expiresAt,
      },
    });

    // Limpa o cookie do verifier
    cookieStore.delete('anthropic_oauth_verifier');

    return NextResponse.json({
      success: true,
      message: 'Conectado ao Claude Pro/Max com sucesso!',
    });
  } catch (error) {
    console.error('Error in Anthropic OAuth callback:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao processar autorizacao' },
      { status: 500 }
    );
  }
}

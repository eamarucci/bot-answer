import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

// Modelos Claude disponiveis via OAuth (Claude Pro/Max)
const ANTHROPIC_OAUTH_MODELS = [
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', description: 'Equilibrio entre velocidade e capacidade (Recomendado)' },
  { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', description: 'Mais poderoso, ideal para tarefas complexas' },
  { id: 'claude-haiku-3-5-20241022', name: 'Claude Haiku 3.5', description: 'Mais rapido, ideal para tarefas simples' },
];

/**
 * GET /api/oauth/anthropic
 * 
 * Retorna o status da conexao OAuth do Anthropic
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.adminId) {
      return NextResponse.json(
        { success: false, error: 'Nao autenticado' },
        { status: 401 }
      );
    }

    const admin = await prisma.admin.findUnique({
      where: { id: session.adminId },
      select: {
        anthropicOAuthRefresh: true,
        anthropicOAuthExpires: true,
        anthropicOAuthModel: true,
      },
    });

    const isConnected = !!admin?.anthropicOAuthRefresh;
    const expiresAt = admin?.anthropicOAuthExpires;
    const model = admin?.anthropicOAuthModel || ANTHROPIC_OAUTH_MODELS[0].id;

    return NextResponse.json({
      success: true,
      connected: isConnected,
      expiresAt: expiresAt?.toISOString() || null,
      model,
      availableModels: ANTHROPIC_OAUTH_MODELS,
    });
  } catch (error) {
    console.error('Error getting Anthropic OAuth status:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao verificar status' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/oauth/anthropic
 * 
 * Atualiza o modelo selecionado para OAuth Anthropic
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.adminId) {
      return NextResponse.json(
        { success: false, error: 'Nao autenticado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { model } = body;

    // Valida se o modelo é valido
    const validModel = ANTHROPIC_OAUTH_MODELS.find(m => m.id === model);
    if (!validModel) {
      return NextResponse.json(
        { success: false, error: 'Modelo invalido' },
        { status: 400 }
      );
    }

    await prisma.admin.update({
      where: { id: session.adminId },
      data: {
        anthropicOAuthModel: model,
      },
    });

    return NextResponse.json({
      success: true,
      model,
    });
  } catch (error) {
    console.error('Error updating Anthropic OAuth model:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao atualizar modelo' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/oauth/anthropic
 * 
 * Remove a conexao OAuth do Anthropic
 */
export async function DELETE() {
  try {
    const session = await getSession();
    if (!session?.adminId) {
      return NextResponse.json(
        { success: false, error: 'Nao autenticado' },
        { status: 401 }
      );
    }

    await prisma.admin.update({
      where: { id: session.adminId },
      data: {
        anthropicOAuthRefresh: null,
        anthropicOAuthExpires: null,
        anthropicOAuthModel: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Desconectado do Claude Pro/Max',
    });
  } catch (error) {
    console.error('Error disconnecting Anthropic OAuth:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao desconectar' },
      { status: 500 }
    );
  }
}

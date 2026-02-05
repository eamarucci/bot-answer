import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { encrypt } from '@botanswer/crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '';

interface Params {
  params: Promise<{ groupId: string }>;
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { groupId } = await params;
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
    }

    // Verifica se o grupo pertence ao admin
    const group = await prisma.groupConfig.findUnique({
      where: { id: groupId },
    });

    if (!group || group.adminId !== session.adminId) {
      return NextResponse.json({ error: 'Grupo nao encontrado' }, { status: 404 });
    }

    const body = await request.json();
    const { apiKey, visionApiKey, model, systemPrompt, allowAll } = body;

    const updateData: Record<string, unknown> = {};

    // Atualiza chaves API
    if (apiKey === null) {
      // Usar chaves padrao do admin
      updateData.apiKey = null;
      updateData.visionApiKey = null;
    } else if (apiKey) {
      updateData.apiKey = encrypt(apiKey, ENCRYPTION_KEY);
      if (visionApiKey === null) {
        updateData.visionApiKey = null;
      } else if (visionApiKey) {
        updateData.visionApiKey = encrypt(visionApiKey, ENCRYPTION_KEY);
      }
    }

    // Atualiza modelo
    if (model !== undefined) {
      updateData.model = model;
    }

    // Atualiza system prompt
    if (systemPrompt !== undefined) {
      updateData.systemPrompt = systemPrompt;
    }

    // Atualiza controle de acesso
    if (allowAll !== undefined) {
      updateData.allowAll = allowAll;
    }

    await prisma.groupConfig.update({
      where: { id: groupId },
      data: updateData,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro em PUT /api/groups/[groupId]:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

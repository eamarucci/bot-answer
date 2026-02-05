import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { encrypt } from '@botanswer/crypto';
import { isValidProvider } from '@botanswer/database';

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
    const { 
      provider, 
      model, 
      apiKey, 
      visionProvider,
      visionModel,
      visionApiKey, 
      systemPrompt, 
      allowAll,
    } = body;

    const updateData: Record<string, unknown> = {};

    // Atualiza provedor de texto
    if (provider !== undefined) {
      if (provider && !isValidProvider(provider)) {
        return NextResponse.json({ error: 'Provedor invalido' }, { status: 400 });
      }
      updateData.provider = provider;
    }

    // Atualiza modelo de texto
    if (model !== undefined) {
      updateData.model = model || 'auto';
    }

    // Atualiza chave API de texto
    if (apiKey === null) {
      updateData.apiKey = null;
    } else if (apiKey) {
      updateData.apiKey = encrypt(apiKey, ENCRYPTION_KEY);
    }

    // Atualiza provedor de vision
    if (visionProvider !== undefined) {
      if (visionProvider && !isValidProvider(visionProvider)) {
        return NextResponse.json({ error: 'Provedor de vision invalido' }, { status: 400 });
      }
      updateData.visionProvider = visionProvider;
    }

    // Atualiza modelo de vision
    if (visionModel !== undefined) {
      updateData.visionModel = visionModel;
    }

    // Atualiza chave de vision
    if (visionApiKey === null) {
      updateData.visionApiKey = null;
    } else if (visionApiKey) {
      updateData.visionApiKey = encrypt(visionApiKey, ENCRYPTION_KEY);
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

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { encrypt } from '@botanswer/crypto';
import { isValidProvider } from '@botanswer/database';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '';

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      provider, 
      model, 
      apiKey, 
      visionProvider,
      visionModel,
      visionApiKey,
    } = body;

    const updateData: Record<string, string | null> = {};

    // Atualiza provedor de texto
    if (provider !== undefined) {
      if (provider && !isValidProvider(provider)) {
        return NextResponse.json({ error: 'Provedor invalido' }, { status: 400 });
      }
      updateData.defaultProvider = provider || null;
    }

    // Atualiza modelo de texto
    if (model !== undefined) {
      updateData.defaultModel = model || null;
    }

    // Atualiza chave API de texto
    if (apiKey) {
      updateData.defaultApiKey = encrypt(apiKey, ENCRYPTION_KEY);
    }

    // Atualiza provedor de vision
    if (visionProvider !== undefined) {
      if (visionProvider && !isValidProvider(visionProvider)) {
        return NextResponse.json({ error: 'Provedor de vision invalido' }, { status: 400 });
      }
      updateData.defaultVisionProvider = visionProvider || null;
    }

    // Atualiza modelo de vision
    if (visionModel !== undefined) {
      updateData.defaultVisionModel = visionModel || null;
    }

    // Atualiza chave de vision
    if (visionApiKey !== undefined) {
      if (visionApiKey === null) {
        updateData.defaultVisionApiKey = null;
      } else if (visionApiKey) {
        updateData.defaultVisionApiKey = encrypt(visionApiKey, ENCRYPTION_KEY);
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Nenhum dado para atualizar' }, { status: 400 });
    }

    await prisma.admin.update({
      where: { id: session.adminId },
      data: updateData,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro em PUT /api/admin/keys:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

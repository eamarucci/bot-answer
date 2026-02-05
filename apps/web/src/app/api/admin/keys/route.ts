import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { encrypt } from '@botanswer/crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '';

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { apiKey, visionApiKey } = body;

    const updateData: Record<string, string | null> = {};

    if (apiKey) {
      updateData.defaultApiKey = encrypt(apiKey, ENCRYPTION_KEY);
    }

    if (visionApiKey) {
      updateData.defaultVisionApiKey = encrypt(visionApiKey, ENCRYPTION_KEY);
    } else if (apiKey && visionApiKey === undefined) {
      // Se atualizou apiKey mas visionApiKey é undefined, limpa a visionApiKey
      // (usa mesma chave)
      updateData.defaultVisionApiKey = null;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Nenhuma chave fornecida' }, { status: 400 });
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

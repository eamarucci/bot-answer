import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

interface Params {
  params: Promise<{ groupId: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
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
    const { phoneNumber } = body;

    if (!phoneNumber) {
      return NextResponse.json({ error: 'Numero de telefone obrigatorio' }, { status: 400 });
    }

    const cleanPhone = phoneNumber.replace(/\D/g, '');

    // Verifica se ja existe
    const existing = await prisma.user.findUnique({
      where: {
        phoneNumber_groupConfigId: {
          phoneNumber: cleanPhone,
          groupConfigId: groupId,
        },
      },
    });

    if (existing) {
      return NextResponse.json({ error: 'Usuario ja existe neste grupo' }, { status: 400 });
    }

    // Cria usuario
    const user = await prisma.user.create({
      data: {
        phoneNumber: cleanPhone,
        groupConfigId: groupId,
        isEnabled: true,
      },
    });

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error('Erro em POST /api/groups/[groupId]/users:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

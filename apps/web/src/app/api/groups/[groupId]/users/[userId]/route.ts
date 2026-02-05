import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

interface Params {
  params: Promise<{ groupId: string; userId: string }>;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { groupId, userId } = await params;
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

    // Verifica se o usuario pertence ao grupo
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.groupConfigId !== groupId) {
      return NextResponse.json({ error: 'Usuario nao encontrado' }, { status: 404 });
    }

    const body = await request.json();
    const { isEnabled } = body;

    await prisma.user.update({
      where: { id: userId },
      data: { isEnabled },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro em PATCH /api/groups/[groupId]/users/[userId]:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { groupId, userId } = await params;
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

    // Verifica se o usuario pertence ao grupo
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.groupConfigId !== groupId) {
      return NextResponse.json({ error: 'Usuario nao encontrado' }, { status: 404 });
    }

    await prisma.user.delete({
      where: { id: userId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro em DELETE /api/groups/[groupId]/users/[userId]:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

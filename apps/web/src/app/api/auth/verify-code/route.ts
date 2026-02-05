import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { setSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phoneNumber, code } = body;

    if (!phoneNumber || !code) {
      return NextResponse.json(
        { error: 'Numero e codigo sao obrigatorios' },
        { status: 400 }
      );
    }

    const cleanPhone = phoneNumber.replace(/\D/g, '');
    const cleanCode = code.replace(/\D/g, '');

    // Busca codigo valido
    const authCode = await prisma.authCode.findFirst({
      where: {
        phoneNumber: cleanPhone,
        code: cleanCode,
        usedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        admin: true,
      },
    });

    if (!authCode || !authCode.admin) {
      return NextResponse.json(
        { error: 'Codigo invalido ou expirado' },
        { status: 401 }
      );
    }

    // Marca codigo como usado
    await prisma.authCode.update({
      where: { id: authCode.id },
      data: { usedAt: new Date() },
    });

    // Atualiza ultimo login do admin
    await prisma.admin.update({
      where: { id: authCode.admin.id },
      data: { lastLoginAt: new Date() },
    });

    // Cria sessao
    await setSession({
      adminId: authCode.admin.id,
      phoneNumber: authCode.admin.phoneNumber,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro em verify-code:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { setSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phoneNumber, code } = body;

    if (!phoneNumber || !code) {
      return NextResponse.json(
        { error: 'Dados incompletos' },
        { status: 400 }
      );
    }

    const cleanPhone = phoneNumber.replace(/\D/g, '');

    // Busca o codigo de autenticacao
    const authCode = await prisma.authCode.findFirst({
      where: {
        phoneNumber: cleanPhone,
        code,
        confirmedAt: { not: null }, // Deve estar confirmado pelo bot
        usedAt: null, // Mas ainda nao usado para login
        expiresAt: { gt: new Date() },
      },
      include: {
        admin: true,
      },
    });

    if (!authCode || !authCode.admin) {
      // Codigo nao confirmado ainda ou invalido
      return NextResponse.json({ confirmed: false });
    }

    // Marca codigo como usado
    await prisma.authCode.update({
      where: { id: authCode.id },
      data: { usedAt: new Date() },
    });

    // Salva sessao
    await setSession({
      adminId: authCode.admin.id,
      phoneNumber: cleanPhone,
    });

    return NextResponse.json({ confirmed: true });
  } catch (error) {
    console.error('Erro em check-confirmation:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

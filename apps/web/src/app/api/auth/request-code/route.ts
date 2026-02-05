import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isRelay } from '@/lib/mautrix-db';
import { generateVerificationCode } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phoneNumber } = body;

    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return NextResponse.json(
        { error: 'Numero de telefone invalido' },
        { status: 400 }
      );
    }

    // Remove caracteres nao numericos
    const cleanPhone = phoneNumber.replace(/\D/g, '');

    if (cleanPhone.length < 10 || cleanPhone.length > 15) {
      return NextResponse.json(
        { error: 'Numero de telefone invalido' },
        { status: 400 }
      );
    }

    // Verifica se é relay de algum grupo
    const isRelayUser = await isRelay(cleanPhone);

    if (!isRelayUser) {
      return NextResponse.json(
        { error: 'Este numero nao é relay de nenhum grupo. Configure um grupo com !wa set-relay primeiro.' },
        { status: 403 }
      );
    }

    // Gera codigo de verificacao
    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

    // Busca ou cria admin
    let admin = await prisma.admin.findUnique({
      where: { phoneNumber: cleanPhone },
    });

    if (!admin) {
      admin = await prisma.admin.create({
        data: { phoneNumber: cleanPhone },
      });
    }

    // Invalida codigos anteriores nao usados
    await prisma.authCode.updateMany({
      where: {
        phoneNumber: cleanPhone,
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    });

    // Cria novo codigo
    await prisma.authCode.create({
      data: {
        code,
        phoneNumber: cleanPhone,
        adminId: admin.id,
        expiresAt,
      },
    });

    // Retorna o codigo para o usuario mostrar na tela
    // A confirmacao sera feita via comando /ia -confirmar no WhatsApp
    return NextResponse.json({ success: true, code });
  } catch (error) {
    console.error('Erro em request-code:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

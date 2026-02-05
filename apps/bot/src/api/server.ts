import { createServer, IncomingMessage, ServerResponse } from 'http';
import { MatrixClient } from 'matrix-bot-sdk';
import { logger } from '../utils/logger.js';

const API_PORT = parseInt(process.env.BOT_API_PORT || '3001', 10);

interface VerificationRequest {
  phoneNumber: string;
  code: string;
}

let matrixClient: MatrixClient | null = null;

export function setMatrixClient(client: MatrixClient) {
  matrixClient = client;
}

async function parseBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

async function sendVerificationCode(
  phoneNumber: string,
  code: string
): Promise<boolean> {
  if (!matrixClient) {
    logger.error('Matrix client nao inicializado');
    return false;
  }

  try {
    // Envia mensagem direta para o usuario via Matrix/WhatsApp
    // O usuario é identificado pelo numero de telefone
    const userId = `@whatsapp_${phoneNumber}:${process.env.MATRIX_USER_ID?.split(':')[1] || 'matrix.marucci.cloud'}`;

    // Tenta criar sala DM ou encontrar existente
    let roomId: string;

    try {
      // Busca sala DM existente
      const joinedRooms = await matrixClient.getJoinedRooms();

      // Procura sala com apenas o usuario e o bot
      for (const room of joinedRooms) {
        try {
          const members = await matrixClient.getJoinedRoomMembers(room);
          if (
            members.length === 2 &&
            members.includes(userId) &&
            members.includes(process.env.MATRIX_USER_ID || '')
          ) {
            roomId = room;
            break;
          }
        } catch {
          continue;
        }
      }

      // Se nao encontrou, cria nova sala DM
      if (!roomId!) {
        const createResult = await matrixClient.createRoom({
          is_direct: true,
          invite: [userId],
          preset: 'trusted_private_chat',
        });
        roomId = createResult;
        logger.info(`Sala DM criada: ${roomId}`);
      }
    } catch (error) {
      logger.error('Erro ao encontrar/criar sala DM:', { error: error instanceof Error ? error.message : String(error) });
      return false;
    }

    // Envia mensagem com o codigo
    await matrixClient.sendText(
      roomId,
      `Seu codigo de verificacao BotAnswer: ${code}\n\nEste codigo expira em 10 minutos.`
    );

    logger.info(`Codigo de verificacao enviado para ${phoneNumber}`);
    return true;
  } catch (error) {
    logger.error('Erro ao enviar codigo de verificacao:', { error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health check
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  // Enviar codigo de verificacao
  if (req.url === '/api/send-verification' && req.method === 'POST') {
    try {
      const body = (await parseBody(req)) as VerificationRequest;

      if (!body.phoneNumber || !body.code) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'phoneNumber e code sao obrigatorios' }));
        return;
      }

      const success = await sendVerificationCode(body.phoneNumber, body.code);

      if (success) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } else {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Erro ao enviar codigo' }));
      }
    } catch (error) {
      logger.error('Erro ao processar request:', { error: error instanceof Error ? error.message : String(error) });
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Erro interno' }));
    }
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
}

export function startApiServer(): void {
  const server = createServer(handleRequest);

  server.listen(API_PORT, () => {
    logger.info(`API server rodando na porta ${API_PORT}`);
  });
}

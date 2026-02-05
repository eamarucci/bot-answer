import { NextRequest, NextResponse } from 'next/server';
import { 
  PROVIDERS, 
  isValidProvider, 
  parseModelsResponse,
  type ProviderId,
  type ModelInfo,
} from '@botanswer/database';

export interface ModelsResponse {
  success: boolean;
  models?: ModelInfo[];
  error?: string;
}

/**
 * POST /api/providers/models
 * 
 * Busca lista de modelos de um provedor usando a chave fornecida.
 * Tambem serve como validacao da chave API.
 * 
 * Body: { provider: string, apiKey: string }
 * Returns: { success: boolean, models?: ModelInfo[], error?: string }
 */
export async function POST(request: NextRequest): Promise<NextResponse<ModelsResponse>> {
  try {
    const body = await request.json();
    const { provider, apiKey } = body;

    // Validacao
    if (!provider || typeof provider !== 'string') {
      return NextResponse.json({ 
        success: false, 
        error: 'Provedor nao informado' 
      }, { status: 400 });
    }

    if (!apiKey || typeof apiKey !== 'string') {
      return NextResponse.json({ 
        success: false, 
        error: 'Chave API nao informada' 
      }, { status: 400 });
    }

    if (!isValidProvider(provider)) {
      return NextResponse.json({ 
        success: false, 
        error: `Provedor invalido: ${provider}` 
      }, { status: 400 });
    }

    const providerConfig = PROVIDERS[provider as ProviderId];

    // Monta URL e headers
    const url = `${providerConfig.baseUrl}${providerConfig.modelsEndpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Auth header
    if (providerConfig.authHeader) {
      headers[providerConfig.authHeader] = apiKey;
    } else {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    // Headers extras (ex: anthropic-version)
    if (providerConfig.extraHeaders) {
      Object.assign(headers, providerConfig.extraHeaders);
    }

    // Faz request para API do provedor
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      
      // Mensagens de erro amigaveis
      if (response.status === 401) {
        return NextResponse.json({ 
          success: false, 
          error: 'Chave API invalida ou expirada' 
        }, { status: 200 }); // 200 para o frontend tratar
      }
      
      if (response.status === 403) {
        return NextResponse.json({ 
          success: false, 
          error: 'Acesso negado. Verifique as permissoes da chave.' 
        }, { status: 200 });
      }

      console.error(`Erro ao buscar modelos de ${provider}:`, response.status, errorText);
      return NextResponse.json({ 
        success: false, 
        error: `Erro ao conectar com ${providerConfig.name}: ${response.status}` 
      }, { status: 200 });
    }

    const data = await response.json();
    
    // Parsea resposta para formato padronizado
    const models = parseModelsResponse(provider as ProviderId, data);

    if (models.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Nenhum modelo disponivel encontrado' 
      }, { status: 200 });
    }

    return NextResponse.json({ 
      success: true, 
      models 
    });

  } catch (error) {
    console.error('Erro em POST /api/providers/models:', error);
    
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json({ 
        success: false, 
        error: 'Tempo limite excedido ao conectar com o provedor' 
      }, { status: 200 });
    }

    return NextResponse.json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    }, { status: 500 });
  }
}

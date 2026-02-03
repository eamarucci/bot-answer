# BotAnswer - Contexto para Claude

## Visao Geral

Bot para Matrix que responde perguntas usando LLMs via OpenRouter API. Configuracao de modelo e system prompt e persistida por sala. Suporta analise de imagens e videos.

## Comandos de Desenvolvimento

```bash
# Instalar dependencias
npm install

# Desenvolvimento com hot-reload
npm run dev

# Verificar tipos TypeScript
npm run typecheck

# Build para producao
npm run build

# Executar em producao
npm start
```

## Arquitetura

```
src/
├── index.ts                 # Entry point, inicializacao
├── config.ts                # Configuracao com Zod validation
├── matrix/
│   ├── client.ts            # Cliente Matrix (conexao, lifecycle)
│   ├── handlers.ts          # Handler de mensagens recebidas
│   ├── context.ts           # Busca contexto (reply chain + recentes)
│   └── image.ts             # Download de imagens/videos do Matrix
├── commands/
│   ├── index.ts             # Router de comandos
│   ├── parser.ts            # Parser de comandos e flags
│   └── handlers/            # Handlers individuais por comando
│       ├── ask.ts           # Processa pergunta para LLM
│       ├── set-model.ts     # Define modelo da sala
│       ├── set-prompt.ts    # Define system prompt
│       ├── list-models.ts   # Lista modelos disponiveis
│       ├── show-config.ts   # Mostra config da sala
│       ├── reset.ts         # Reseta config
│       └── help.ts          # Mostra ajuda
├── llm/
│   ├── openrouter-client.ts # Cliente OpenRouter API
│   ├── model-aliases.ts     # Mapeamento de aliases para modelos
│   └── types.ts             # Types para LLM
├── storage/
│   └── room-settings.ts     # Persistencia de config por sala (JSON)
└── utils/
    ├── logger.ts            # Logger com niveis
    └── errors.ts            # Erros formatados para usuario
```

## Comandos do Bot

| Comando | Descricao |
|---------|-----------|
| `/ia <mensagem>` | Envia pergunta para a LLM |
| `/ia -set <modelo>` | Define modelo da sala |
| `/ia -prompt <texto>` | Define system prompt da sala |
| `/ia -modelos` | Lista modelos disponiveis |
| `/ia -config` | Mostra configuracao da sala |
| `/ia -reset` | Reseta configuracao para padroes |
| `/ia -ajuda` | Mostra ajuda |

## Sistema de Aliases de Modelos

Os modelos sao chamados por aliases curtos em vez de IDs completos:

| Alias | Modelo OpenRouter | Descricao |
|-------|-------------------|-----------|
| `auto` | `openrouter/free` | Escolhe entre modelos gratuitos |
| `deepseek` | `deepseek/deepseek-r1-0528:free` | Raciocinio avancado |
| `llama` | `meta-llama/llama-3.3-70b-instruct:free` | Meta Llama 3.3 70B |
| `vision` | `nvidia/nemotron-nano-12b-v2-vl:free` | Analise de imagens/videos |

Para adicionar/modificar modelos, edite `src/llm/model-aliases.ts`.

## Analise de Imagens e Videos

O bot detecta automaticamente quando o comando `/ia` e um reply para uma imagem ou video:

- **Imagens**: Baixa, converte para base64 e envia para o modelo de vision
- **Videos**: Baixa, converte para base64 e envia (limite: 20MB)
- O modelo de vision e usado automaticamente quando midia e detectada

## System Prompts

O sistema usa dois prompts:

1. **BASE_SYSTEM_PROMPT** (fixo): Regras de formatacao (max 4 frases, sem listas)
2. **DEFAULT_SYSTEM_PROMPT** (editavel via `/ia -prompt`): Contexto adicional

## Fluxo de Contexto

O bot monta contexto de conversa para enviar ao LLM:

1. **Com reply**: Segue a cadeia de replies para construir contexto
2. **Sem reply**: Busca ultimas N mensagens da sala
3. **Com midia**: Nao inclui contexto anterior, foca na imagem/video

### Limites de Contexto

- `CONTEXT_MAX_MESSAGES`: Maximo de mensagens no contexto (default: 10)
- `CONTEXT_MAX_AGE_MINUTES`: Idade maxima das mensagens (default: 30 min)

## Persistencia

### Arquivos de Dados

- **Estado do sync**: `data/bot-state.json` - posicao do sync do Matrix
- **Config por sala**: `data/room-settings.json` - modelo e prompt de cada sala

### Estrutura de Room Settings

```json
{
  "!roomId:server": {
    "model": "deepseek",
    "systemPrompt": "Voce e um especialista em Python..."
  }
}
```

## Variaveis de Ambiente

```env
# Matrix
MATRIX_HOMESERVER_URL=https://matrix.marucci.cloud
MATRIX_ACCESS_TOKEN=syt_xxx
MATRIX_USER_ID=@bot-answer:matrix.marucci.cloud

# OpenRouter
OPENROUTER_API_KEY=sk-or-xxx
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

# Models
DEFAULT_MODEL=openrouter/free
VISION_MODEL=nvidia/nemotron-nano-12b-v2-vl:free

# System Prompts
BASE_SYSTEM_PROMPT=LIMITE ABSOLUTO: 4 frases...
DEFAULT_SYSTEM_PROMPT=Voce e um assistente de chat prestativo.

# LLM Settings
MAX_TOKENS=2000
TIMEOUT_MS=60000
INCLUDE_REASONING=false

# Context
CONTEXT_MAX_MESSAGES=10
CONTEXT_MAX_AGE_MINUTES=30

# Bot
BOT_STATE_FILE=data/bot-state.json
ROOM_SETTINGS_FILE=data/room-settings.json
COMMAND_PREFIX=/ia
LOG_LEVEL=info
```

## OpenRouter API

### Endpoint
```
POST https://openrouter.ai/api/v1/chat/completions
```

### Headers
```
Authorization: Bearer sk-or-xxx
Content-Type: application/json
HTTP-Referer: https://github.com/eamarucci/bot-answer
X-Title: BotAnswer
```

### Request Body (texto)
```json
{
  "model": "openrouter/free",
  "messages": [
    {"role": "system", "content": "..."},
    {"role": "user", "content": "..."}
  ],
  "max_tokens": 2000
}
```

### Request Body (imagem)
```json
{
  "model": "nvidia/nemotron-nano-12b-v2-vl:free",
  "messages": [
    {"role": "system", "content": "..."},
    {"role": "user", "content": [
      {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,..."}},
      {"type": "text", "text": "Descreva esta imagem."}
    ]}
  ]
}
```

## Deploy

### Build e Push Docker

```bash
cd /home/evandro/projects/bot/answer
docker build -t eamarucci/bot-answer:latest .
docker push eamarucci/bot-answer:latest
```

### Gerar Token Matrix

```bash
./scripts/get-token.sh --help
./scripts/get-token.sh -h https://matrix.example.com -u @bot:example.com -p senha
```

### Docker Compose

```yaml
services:
  bot-answer:
    image: eamarucci/bot-answer:latest
    container_name: bot-answer
    restart: unless-stopped
    volumes:
      - ./data:/app/data
    networks:
      - infra-network

networks:
  infra-network:
    external: true
```

## Troubleshooting

- **Bot nao responde**: Verificar se o token Matrix esta valido
- **Erro de modelo**: Verificar se o alias existe em `model-aliases.ts`
- **Contexto vazio**: Verificar `CONTEXT_MAX_AGE_MINUTES`
- **Timeout**: Aumentar `TIMEOUT_MS` ou usar modelo mais rapido
- **Resposta cortada**: Aumentar `MAX_TOKENS`
- **Imagem nao analisa**: Verificar se VISION_MODEL esta configurado

## Padroes de Codigo

- TypeScript ES Modules (extensao .js nos imports)
- Zod para validacao de configuracao
- matrix-bot-sdk para conexao Matrix
- Fetch nativo para requisicoes HTTP
- Tratamento de erros com mensagens amigaveis para usuario

## Repositorios

- **GitHub**: https://github.com/eamarucci/bot-answer
- **Docker Hub**: eamarucci/bot-answer

# AiAnswerBot - Contexto para Claude

## Visao Geral

Bot para Matrix que responde perguntas usando LLMs via OpenRouter API. Configuracao de modelo e system prompt e persistida por sala.

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
│   └── context.ts           # Busca contexto (reply chain + recentes)
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
| `/ai <mensagem>` | Envia pergunta para a LLM |
| `/ai -set <modelo>` | Define modelo da sala |
| `/ai -prompt <texto>` | Define system prompt da sala |
| `/ai -modelos` | Lista modelos disponiveis |
| `/ai -config` | Mostra configuracao da sala |
| `/ai -reset` | Reseta configuracao para padroes |
| `/ai -ajuda` | Mostra ajuda |

## Sistema de Aliases de Modelos

Os modelos sao chamados por aliases curtos em vez de IDs completos:

| Alias | Modelo OpenRouter | Descricao |
|-------|-------------------|-----------|
| `auto` | `openrouter/free` | Escolhe entre modelos gratuitos |
| `deepseek` | `deepseek/deepseek-r1-0528:free` | Raciocinio avancado |
| `llama` | `meta-llama/llama-3.3-70b-instruct:free` | Meta Llama 3.3 70B |

Para adicionar/modificar modelos, edite `src/llm/model-aliases.ts`.

## Fluxo de Contexto

O bot monta contexto de conversa para enviar ao LLM:

1. **Com reply**: Segue a cadeia de replies para construir contexto
2. **Sem reply**: Busca ultimas N mensagens da sala

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
MATRIX_USER_ID=@aianswer-bot:matrix.marucci.cloud

# OpenRouter
OPENROUTER_API_KEY=sk-or-xxx
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

# Models
DEFAULT_MODEL=openrouter/free

# LLM Settings
MAX_TOKENS=1000
TIMEOUT_MS=60000
INCLUDE_REASONING=false
DEFAULT_SYSTEM_PROMPT=Voce e um assistente prestativo...

# Context
CONTEXT_MAX_MESSAGES=10
CONTEXT_MAX_AGE_MINUTES=30

# Bot
BOT_STATE_FILE=data/bot-state.json
ROOM_SETTINGS_FILE=data/room-settings.json
COMMAND_PREFIX=/ai
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
HTTP-Referer: https://matrix.marucci.cloud
X-Title: AiAnswerBot
```

### Request Body
```json
{
  "model": "openrouter/free",
  "messages": [
    {"role": "system", "content": "..."},
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": "..."}
  ],
  "max_tokens": 1000
}
```

## Deploy

### Build e Push (se usar Docker)

```bash
cd /home/evandro/projects/matrix/aianswer-bot
docker build -t eamarucci/aianswer-bot:latest .
docker push eamarucci/aianswer-bot:latest
```

### Execucao Direta

```bash
npm run build
npm start
```

### Com PM2

```bash
pm2 start dist/index.js --name aianswer-bot
```

### Docker Compose

```yaml
services:
  aianswer-bot:
    image: eamarucci/aianswer-bot:latest
    container_name: aianswer-bot
    restart: unless-stopped
    env_file:
      - .env
    volumes:
      - ./data:/app/data

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
- **Reasoning nao aparece**: Verificar `INCLUDE_REASONING=true`

## Padroes de Codigo

- TypeScript ES Modules (extensao .js nos imports)
- Zod para validacao de configuracao
- matrix-bot-sdk para conexao Matrix
- Fetch nativo para requisicoes HTTP
- Tratamento de erros com mensagens amigaveis para usuario

## Relacionamento com Outros Bots

Este bot e independente do `aiimg-bot`. Cada um tem funcao especifica:

| Bot | Funcao | Comando |
|-----|--------|---------|
| `aianswer-bot` | Perguntas para LLM | `/ai` |
| `aiimg-bot` | Geracao de imagens | `/img` |

Ambos podem coexistir na mesma sala sem conflito.

# BotAnswer

Bot para Matrix que utiliza a API do OpenRouter para responder perguntas usando diversas LLMs.

## Funcionalidades

- Responde perguntas usando LLMs via OpenRouter API
- Suporta multiplos modelos de IA com aliases simples
- Configuracao de modelo e system prompt por sala
- Mantem contexto de mensagens anteriores
- Suporta cadeia de replies para conversas continuadas

## Comandos

| Comando | Descricao |
|---------|-----------|
| `/ia <mensagem>` | Envia uma pergunta para a IA |
| `/ia -set <modelo>` | Define o modelo de IA para esta sala |
| `/ia -prompt <texto>` | Define o system prompt para esta sala |
| `/ia -modelos` | Lista os modelos disponiveis |
| `/ia -config` | Mostra a configuracao atual da sala |
| `/ia -reset` | Reseta a configuracao da sala para os padroes |
| `/ia -ajuda` | Mostra ajuda dos comandos |

## Modelos Disponiveis

| Alias | Modelo | Descricao |
|-------|--------|-----------|
| `auto` | openrouter/auto | Escolhe o melhor modelo automaticamente |
| `deepseek` | deepseek/deepseek-r1-0528:free | DeepSeek R1 (raciocinio avancado) |
| `llama` | meta-llama/llama-3.3-70b-instruct:free | Llama 3.3 70B da Meta |

Exemplo: `/ia -set deepseek`

## Configuracao

1. Copie o arquivo `.env.example` para `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Configure as variaveis de ambiente:

   ```env
   # Matrix
   MATRIX_HOMESERVER_URL=https://matrix.example.com
   MATRIX_ACCESS_TOKEN=syt_xxxxxxxxxxxxx
   MATRIX_USER_ID=@aibot:example.com

   # OpenRouter
   OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxx

   # Modelo padrao (alias)
   DEFAULT_MODEL=openrouter/auto

   # System Prompt padrao
   DEFAULT_SYSTEM_PROMPT=Voce e um assistente prestativo...
   ```

3. Instale as dependencias:
   ```bash
   npm install
   ```

4. Inicie o bot:
   ```bash
   # Desenvolvimento (com hot-reload)
   npm run dev

   # Producao
   npm run build
   npm start
   ```

## Variaveis de Ambiente

| Variavel | Descricao | Padrao |
|----------|-----------|--------|
| `MATRIX_HOMESERVER_URL` | URL do servidor Matrix | - |
| `MATRIX_ACCESS_TOKEN` | Token de acesso do bot | - |
| `MATRIX_USER_ID` | ID do usuario do bot | - |
| `OPENROUTER_API_KEY` | Chave da API OpenRouter | - |
| `OPENROUTER_BASE_URL` | URL base da API | `https://openrouter.ai/api/v1` |
| `DEFAULT_MODEL` | Modelo padrao | `openrouter/auto` |
| `DEFAULT_SYSTEM_PROMPT` | Prompt padrao do sistema | - |
| `MAX_TOKENS` | Limite de tokens na resposta | `1000` |
| `TIMEOUT_MS` | Timeout da API em ms | `60000` |
| `CONTEXT_MAX_MESSAGES` | Max mensagens no contexto | `10` |
| `CONTEXT_MAX_AGE_MINUTES` | Idade max das mensagens | `30` |
| `BOT_STATE_FILE` | Arquivo de estado do sync | `data/bot-state.json` |
| `ROOM_SETTINGS_FILE` | Arquivo de config por sala | `data/room-settings.json` |
| `COMMAND_PREFIX` | Prefixo do comando | `/ia` |
| `LOG_LEVEL` | Nivel de log | `info` |

## Contexto de Mensagens

O bot mantem contexto de duas formas:

1. **Reply chain**: Quando voce responde a uma mensagem com `/ia`, o bot inclui a cadeia de respostas como contexto.

2. **Mensagens recentes**: Quando nao ha reply, o bot inclui as ultimas mensagens da sala (configuravel via `CONTEXT_MAX_MESSAGES` e `CONTEXT_MAX_AGE_MINUTES`).

## Estrutura do Projeto

```
bot-answer/
├── src/
│   ├── index.ts                 # Entry point
│   ├── config.ts                # Configuracao com Zod
│   ├── matrix/
│   │   ├── client.ts            # Cliente Matrix
│   │   ├── handlers.ts          # Handler de mensagens
│   │   └── context.ts           # Busca de contexto
│   ├── commands/
│   │   ├── index.ts             # Router de comandos
│   │   ├── parser.ts            # Parser de comandos
│   │   └── handlers/            # Handlers individuais
│   ├── llm/
│   │   ├── openrouter-client.ts # Cliente OpenRouter
│   │   ├── model-aliases.ts     # Aliases dos modelos
│   │   └── types.ts             # Types
│   ├── storage/
│   │   └── room-settings.ts     # Config por sala
│   └── utils/
│       ├── logger.ts            # Logger
│       └── errors.ts            # Erros formatados
├── data/                        # Arquivos de estado
├── package.json
├── tsconfig.json
├── CLAUDE.md                    # Contexto para Claude Code
└── .env.example
```

## Adicionando Novos Modelos

Para adicionar novos modelos, edite `src/llm/model-aliases.ts`:

```typescript
const MODEL_ALIASES: Record<string, string> = {
  "auto": "openrouter/auto",
  "deepseek": "deepseek/deepseek-r1-0528:free",
  "llama": "meta-llama/llama-3.3-70b-instruct:free",
  // Adicione novos modelos aqui:
  "gpt4": "openai/gpt-4o",
};
```

## Licenca

MIT

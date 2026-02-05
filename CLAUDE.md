# BotAnswer - Contexto para Claude

## Visao Geral

Bot para Matrix que responde perguntas usando LLMs. Suporta **multiplos provedores** (OpenRouter, OpenAI, Anthropic, Groq). Arquitetura **multi-tenant** onde cada admin (identificado pelo numero de relay do WhatsApp) gerencia suas proprias chaves API, provedores, modelos e usuarios atraves de uma plataforma web.

## Estrutura do Monorepo

```
bot-answer/
├── apps/
│   ├── bot/                 # Bot Matrix (TypeScript)
│   │   ├── src/
│   │   │   ├── index.ts     # Entry point
│   │   │   ├── config.ts    # Configuracao com Zod
│   │   │   ├── auth/        # Autenticacao multi-tenant
│   │   │   │   ├── resolve-phone.ts   # Resolve telefone do sender
│   │   │   │   ├── check-permission.ts
│   │   │   │   └── get-api-key.ts
│   │   │   ├── commands/    # Handlers de comandos
│   │   │   │   ├── handlers/
│   │   │   │   │   ├── ask.ts
│   │   │   │   │   ├── confirm.ts     # /ia -confirmar (auth)
│   │   │   │   │   └── ...
│   │   │   │   ├── parser.ts
│   │   │   │   └── index.ts
│   │   │   ├── db/client.ts # Cliente Prisma
│   │   │   ├── llm/         # Cliente LLM multi-provedor
│   │   │   ├── matrix/      # Cliente Matrix
│   │   │   └── storage/     # Persistencia local
│   │   └── Dockerfile
│   │
│   └── web/                 # Plataforma admin (Next.js 15)
│       ├── src/
│       │   ├── app/
│       │   │   ├── page.tsx           # Login
│       │   │   ├── dashboard/         # Dashboard admin
│       │   │   └── api/               # API routes
│       │   ├── components/
│       │   │   └── login-form.tsx
│       │   └── lib/
│       │       ├── auth.ts            # JWT
│       │       ├── db.ts              # Prisma client
│       │       └── mautrix-db.ts      # Consulta ao bridge
│       └── Dockerfile
│
├── packages/
│   ├── crypto/              # AES-256-GCM encrypt/decrypt
│   │   └── src/
│   │       ├── encrypt.ts
│   │       └── decrypt.ts
│   │
│   └── database/            # Prisma schema + providers
│       ├── prisma/
│       │   └── schema.prisma
│       └── src/
│           ├── index.ts
│           └── providers.ts   # Config de provedores LLM
│
├── .env                     # Variaveis de ambiente
├── .npmrc                   # Config pnpm (build scripts)
├── pnpm-workspace.yaml      # Workspace config
└── docker-compose.yml
```

## Comandos de Desenvolvimento

```bash
# Instalar dependencias (na raiz do projeto)
pnpm install

# Baixar modulo nativo do Matrix (necessario na primeira vez)
cd node_modules/.pnpm/@matrix-org+matrix-sdk-crypto-nodejs@0.1.0-beta.6/node_modules/@matrix-org/matrix-sdk-crypto-nodejs
node download-lib.js
cd -

# Desenvolvimento - Bot (Terminal 1)
pnpm dev:bot

# Desenvolvimento - Web (Terminal 2)
pnpm dev:web

# Build de todos os pacotes
pnpm build

# Verificar tipos TypeScript
pnpm typecheck

# Database - Gerar Prisma client
pnpm db:generate

# Database - Push schema para banco
pnpm db:push
```

## Deploy Docker

```bash
# Build e push da imagem do bot
docker build -f apps/bot/Dockerfile -t eamarucci/bot-answer:latest .
docker push eamarucci/bot-answer:latest

# No servidor - atualizar container
docker pull eamarucci/bot-answer:latest
docker compose up -d --force-recreate bot-answer
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
| `/ia -confirmar <codigo>` | Confirma codigo de autenticacao da web |
| `/ia -ajuda` | Mostra ajuda |

## Fluxo de Autenticacao Web

1. Admin acessa a web e digita numero do WhatsApp (relay)
2. Web gera codigo de 6 digitos e mostra na tela
3. Admin envia `/ia -confirmar CODIGO` em grupo onde é relay
4. Bot verifica que sender é relay do grupo e confirma codigo no banco
5. Web detecta confirmacao via polling e faz login

## Banco de Dados

### PostgreSQL (botanswer)

```
DATABASE_URL=postgresql://user:pass@host:5432/botanswer
```

### Modelos Prisma

- **Admin**: Admins identificados por phoneNumber (relay)
- **GroupConfig**: Configuracao de grupos (chaves API, modelo, etc)
- **User**: Usuarios habilitados por grupo
- **AuthCode**: Codigos de verificacao para login
- **GlobalConfig**: Chave API fallback global

### Mautrix Database (somente leitura)

```
MAUTRIX_DATABASE_URL=postgresql://user:pass@host:5432/mautrix_whatsapp
```

Usado para:
- Verificar se numero é relay de algum grupo
- Listar grupos onde admin é relay
- Resolver telefone de ghosts do WhatsApp

## Variaveis de Ambiente

```env
# Matrix
MATRIX_HOMESERVER_URL=https://matrix.marucci.cloud
MATRIX_ACCESS_TOKEN=syt_xxx
MATRIX_USER_ID=@bot-answer:matrix.marucci.cloud

# Database
DATABASE_URL=postgresql://user:pass@host:5432/botanswer
MAUTRIX_DATABASE_URL=postgresql://user:pass@host:5432/mautrix_whatsapp

# Crypto
ENCRYPTION_KEY=<64 chars hex>

# Web Auth
JWT_SECRET=<base64 string>

# OpenRouter
OPENROUTER_API_KEY=sk-or-xxx
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

# Models
DEFAULT_MODEL=auto
VISION_MODEL=nvidia/nemotron-nano-12b-v2-vl:free

# LLM Settings
MAX_TOKENS=2000
TIMEOUT_MS=60000

# Bot
COMMAND_PREFIX=/ia
LOG_LEVEL=info
```

## Sistema de Aliases de Modelos

| Alias | Modelo OpenRouter | Descricao |
|-------|-------------------|-----------|
| `auto` | `openrouter/free` | Escolhe entre modelos gratuitos |
| `deepseek` | `deepseek/deepseek-r1-0528:free` | Raciocinio avancado |
| `llama` | `meta-llama/llama-3.3-70b-instruct:free` | Meta Llama 3.3 70B |
| `vision` | `nvidia/nemotron-nano-12b-v2-vl:free` | Analise de imagens/videos |

Editar em: `apps/bot/src/llm/model-aliases.ts`

## Hierarquia de Chaves API

1. **Usuario** (se tiver chave propria no grupo)
2. **Grupo** (se tiver chave propria)
3. **Admin** (chave default do admin)
4. **Global** (fallback configurado no GlobalConfig)

## Troubleshooting

- **Bot nao inicia (MODULE_NOT_FOUND crypto)**: Rodar `node download-lib.js` no diretorio do modulo
- **Bot nao responde**: Verificar token Matrix e logs
- **Erro Prisma**: Rodar `pnpm db:generate` e `pnpm db:push`
- **Web erro 500**: Verificar DATABASE_URL e MAUTRIX_DATABASE_URL
- **Login nao funciona**: Verificar se numero é relay de algum grupo no mautrix

## Padroes de Codigo

- TypeScript ES Modules (extensao .js nos imports)
- pnpm workspaces para monorepo
- Prisma para ORM
- Zod para validacao
- Next.js 15 App Router para web
- matrix-bot-sdk para conexao Matrix

## Repositorios

- **GitHub**: https://github.com/eamarucci/bot-answer
- **Docker Hub**: eamarucci/bot-answer

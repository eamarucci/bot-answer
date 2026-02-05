import { z } from "zod";

// Note: Environment variables are loaded via --env-file flag in package.json scripts
// Do not use dotenv here to avoid conflicts

const configSchema = z.object({
  // Matrix
  matrix: z.object({
    homeserverUrl: z.string().url(),
    accessToken: z.string().min(1),
    userId: z.string().startsWith("@"),
  }),

  // OpenRouter
  openRouter: z.object({
    apiKey: z.string().min(1),
    baseUrl: z.string().url().default("https://openrouter.ai/api/v1"),
  }),

  // Models
  models: z.object({
    default: z.string().min(1),
    vision: z.string().min(1).default("nvidia/nemotron-nano-12b-v2-vl:free"),
  }),

  // LLM Settings
  llm: z.object({
    maxTokens: z.number().int().positive().default(2000),
    timeoutMs: z.number().int().positive().default(60000),
    includeReasoning: z.boolean().default(false),
  }),

  // System Prompts
  systemPrompts: z.object({
    base: z.string().default("LIMITE ABSOLUTO: 4 frases. PROIBIDO: listas, bullets, enumeracoes, mais de 4 frases. Se a resposta exigir mais, resuma ou pergunte o que o usuario quer saber especificamente. Seja direto. Portugues."),
    default: z.string().default("Voce e um assistente de chat prestativo."),
  }),

  // Context Settings
  context: z.object({
    maxMessages: z.number().int().positive().default(10),
    maxAgeMinutes: z.number().int().positive().default(30),
  }),

  // Bot Settings
  bot: z.object({
    stateFile: z.string().default("data/bot-state.json"),
    roomSettingsFile: z.string().default("data/room-settings.json"),
    commandPrefix: z.string().default("/ia"),
    logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
  }),
});

function loadConfig() {
  const rawConfig = {
    matrix: {
      homeserverUrl: process.env.MATRIX_HOMESERVER_URL,
      accessToken: process.env.MATRIX_ACCESS_TOKEN,
      userId: process.env.MATRIX_USER_ID,
    },
    openRouter: {
      apiKey: process.env.OPENROUTER_API_KEY,
      baseUrl: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
    },
    models: {
      default: process.env.DEFAULT_MODEL || "openrouter/free",
      vision: process.env.VISION_MODEL || "nvidia/nemotron-nano-12b-v2-vl:free",
    },
    llm: {
      maxTokens: parseInt(process.env.MAX_TOKENS || "2000", 10),
      timeoutMs: parseInt(process.env.TIMEOUT_MS || "60000", 10),
      includeReasoning: process.env.INCLUDE_REASONING === "true",
    },
    systemPrompts: {
      base: process.env.BASE_SYSTEM_PROMPT || "LIMITE ABSOLUTO: 4 frases. PROIBIDO: listas, bullets, enumeracoes, mais de 4 frases. Se a resposta exigir mais, resuma ou pergunte o que o usuario quer saber especificamente. Seja direto. Portugues.",
      default: process.env.DEFAULT_SYSTEM_PROMPT || "Voce e um assistente de chat prestativo.",
    },
    context: {
      maxMessages: parseInt(process.env.CONTEXT_MAX_MESSAGES || "10", 10),
      maxAgeMinutes: parseInt(process.env.CONTEXT_MAX_AGE_MINUTES || "30", 10),
    },
    bot: {
      stateFile: process.env.BOT_STATE_FILE || "data/bot-state.json",
      roomSettingsFile: process.env.ROOM_SETTINGS_FILE || "data/room-settings.json",
      commandPrefix: process.env.COMMAND_PREFIX || "/ia",
      logLevel: process.env.LOG_LEVEL || "info",
    },
  };

  const result = configSchema.safeParse(rawConfig);

  if (!result.success) {
    console.error("Configuration validation failed:");
    for (const error of result.error.errors) {
      console.error(`  - ${error.path.join(".")}: ${error.message}`);
    }
    process.exit(1);
  }

  return result.data;
}

export const config = loadConfig();
export type Config = z.infer<typeof configSchema>;

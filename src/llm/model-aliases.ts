/**
 * Model aliases for easier command usage.
 * Maps short names to full OpenRouter model IDs.
 */

export interface ModelInfo {
  id: string;
  alias: string;
  description: string;
}

// Map of alias -> full model ID
const MODEL_ALIASES: Record<string, string> = {
  "auto": "openrouter/free",
  "deepseek": "deepseek/deepseek-r1-0528:free",
  "llama": "meta-llama/llama-3.3-70b-instruct:free",
  "vision": "nvidia/nemotron-nano-12b-v2-vl:free",
};

// Reverse map: full model ID -> alias
const MODEL_TO_ALIAS: Record<string, string> = Object.entries(MODEL_ALIASES).reduce(
  (acc, [alias, modelId]) => {
    acc[modelId] = alias;
    return acc;
  },
  {} as Record<string, string>
);

// Model descriptions for help text
const MODEL_DESCRIPTIONS: Record<string, string> = {
  "auto": "OpenRouter Free (escolhe entre modelos gratuitos)",
  "deepseek": "DeepSeek R1 (raciocinio avancado)",
  "llama": "Llama 3.3 70B (Meta)",
  "vision": "Nemotron Nano 12B VL (NVIDIA) - usado automaticamente para imagens",
};

// Default vision model for image analysis
export const VISION_MODEL = "nvidia/nemotron-nano-12b-v2-vl:free";

/**
 * Resolve an alias or model ID to the full model ID.
 * Returns null if not found.
 */
export function resolveModelAlias(input: string): string | null {
  const lowerInput = input.toLowerCase().trim();
  
  // Check if it's an alias
  if (MODEL_ALIASES[lowerInput]) {
    return MODEL_ALIASES[lowerInput];
  }
  
  // Check if it's already a full model ID
  if (MODEL_TO_ALIAS[input] || MODEL_TO_ALIAS[lowerInput]) {
    return input;
  }
  
  return null;
}

/**
 * Get the display name (alias) for a model.
 * Returns the alias if available, otherwise extracts short name from model ID.
 */
export function getModelDisplayName(modelId: string): string {
  // Check if there's an alias for this model
  if (MODEL_TO_ALIAS[modelId]) {
    return MODEL_TO_ALIAS[modelId];
  }
  
  // Fallback: extract the last part of the model ID
  const parts = modelId.split("/");
  return parts[parts.length - 1];
}

/**
 * Get all available aliases with descriptions.
 */
export function getAvailableAliases(): ModelInfo[] {
  return Object.entries(MODEL_ALIASES).map(([alias, id]) => ({
    id,
    alias,
    description: MODEL_DESCRIPTIONS[alias] || alias,
  }));
}

/**
 * Check if an input is a valid model (alias or full ID).
 */
export function isValidModelInput(input: string): boolean {
  return resolveModelAlias(input) !== null;
}

/**
 * Get all valid aliases as a list.
 */
export function getAliasList(): string[] {
  return Object.keys(MODEL_ALIASES);
}

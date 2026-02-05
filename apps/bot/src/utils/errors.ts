export interface FormattedError {
  message: string;
  userFriendly: string;
}

export class BotError extends Error {
  public readonly userFriendly: string;
  public readonly code: string;

  constructor(message: string, userFriendly: string, code: string) {
    super(message);
    this.name = "BotError";
    this.userFriendly = userFriendly;
    this.code = code;
  }
}

export function formatApiError(status: number, message?: string): FormattedError {
  const errorMessages: Record<number, FormattedError> = {
    401: {
      message: `API authentication failed: ${message || "Unauthorized"}`,
      userFriendly: "Erro de configuracao: chave API invalida. Contate o administrador.",
    },
    402: {
      message: `Payment required: ${message || "Insufficient credits"}`,
      userFriendly: "Erro: creditos da API esgotados. Contate o administrador.",
    },
    429: {
      message: `Rate limit exceeded: ${message || "Too many requests"}`,
      userFriendly: "Muitas requisicoes. Aguarde alguns segundos e tente novamente.",
    },
    500: {
      message: `Server error: ${message || "Internal server error"}`,
      userFriendly: "Servico temporariamente indisponivel. Tente novamente em instantes.",
    },
    502: {
      message: `Bad gateway: ${message || "Service unavailable"}`,
      userFriendly: "Servico temporariamente indisponivel. Tente novamente em instantes.",
    },
    503: {
      message: `Service unavailable: ${message || "Service unavailable"}`,
      userFriendly: "Servico temporariamente indisponivel. Tente novamente em instantes.",
    },
  };

  return (
    errorMessages[status] || {
      message: `API error ${status}: ${message || "Unknown error"}`,
      userFriendly: `Erro inesperado (${status}). Tente novamente.`,
    }
  );
}

export function formatTimeoutError(): FormattedError {
  return {
    message: "Request timed out",
    userFriendly: "A requisicao demorou muito. Tente uma pergunta mais curta ou tente novamente.",
  };
}

export function formatModelNotFoundError(model: string, availableModels: string[]): FormattedError {
  const shortNames = availableModels.map((m) => m.split("/").pop() || m);
  return {
    message: `Model not found: ${model}`,
    userFriendly: `Modelo '${model}' nao encontrado.\nModelos disponiveis: ${shortNames.join(", ")}`,
  };
}

export function formatContextTooLongError(): FormattedError {
  return {
    message: "Context too long for model",
    userFriendly: "Mensagem muito longa para o modelo atual. Tente uma pergunta mais curta.",
  };
}

export function formatCommandError(command: string, usage: string): FormattedError {
  return {
    message: `Invalid command usage: ${command}`,
    userFriendly: `Uso: ${usage}`,
  };
}

export function formatGenericError(error: unknown): FormattedError {
  const message = error instanceof Error ? error.message : String(error);
  return {
    message: `Unexpected error: ${message}`,
    userFriendly: "Ocorreu um erro inesperado. Tente novamente.",
  };
}

export class AIServiceError extends Error {
  readonly code: string;
  readonly status?: number;

  constructor(message: string, code = "AI_SERVICE_ERROR", status?: number) {
    super(message);
    this.name = "AIServiceError";
    this.code = code;
    this.status = status;
  }
}

export class AIConfigurationError extends AIServiceError {
  constructor(message: string) {
    super(message, "AI_CONFIGURATION_ERROR");
    this.name = "AIConfigurationError";
  }
}

export class AIRequestError extends AIServiceError {
  constructor(message: string, status?: number) {
    super(message, "AI_REQUEST_ERROR", status);
    this.name = "AIRequestError";
  }
}

export class AIResponseError extends AIServiceError {
  constructor(message: string) {
    super(message, "AI_RESPONSE_ERROR");
    this.name = "AIResponseError";
  }
}

export function normalizeAIError(error: unknown): AIServiceError {
  if (error instanceof AIServiceError) {
    return error;
  }

  if (error instanceof Error) {
    return new AIServiceError(error.message);
  }

  return new AIServiceError("Unexpected AI error");
}

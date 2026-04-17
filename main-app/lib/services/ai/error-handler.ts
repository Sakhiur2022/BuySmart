export class AIServiceError extends Error {
  readonly code: string;
  readonly status?: number;

  constructor(message: string, code = 'AI_SERVICE_ERROR', status?: number) {
    super(message);
    this.name = 'AIServiceError';
    this.code = code;
    this.status = status;
  }
}

export class AIConfigurationError extends AIServiceError {
  constructor(message: string) {
    super(message, 'AI_CONFIGURATION_ERROR');
    this.name = 'AIConfigurationError';
  }
}

export class AIRequestError extends AIServiceError {
  constructor(message: string, status?: number) {
    super(message, 'AI_REQUEST_ERROR', status);
    this.name = 'AIRequestError';
  }
}

export class AIResponseError extends AIServiceError {
  constructor(message: string) {
    super(message, 'AI_RESPONSE_ERROR');
    this.name = 'AIResponseError';
  }
}

export type AIErrorCategory =
  | 'timeout'
  | 'rate_limit'
  | 'configuration'
  | 'response'
  | 'request'
  | 'provider';

export function normalizeAIError(error: unknown): AIServiceError {
  if (error instanceof AIServiceError) {
    return error;
  }

  if (error instanceof Error) {
    return new AIServiceError(error.message);
  }

  return new AIServiceError('Unexpected AI error');
}

export function categorizeAIError(error: unknown): AIErrorCategory {
  const normalized = normalizeAIError(error);
  const message = normalized.message.toLowerCase();

  if (normalized.code === 'AI_CONFIGURATION_ERROR') {
    return 'configuration';
  }

  if (normalized.code === 'AI_RESPONSE_ERROR') {
    return 'response';
  }

  if (normalized.status === 429 || message.includes('rate limit') || message.includes('quota')) {
    return 'rate_limit';
  }

  if (
    normalized.status === 408 ||
    normalized.status === 504 ||
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('aborted')
  ) {
    return 'timeout';
  }

  if (normalized.code === 'AI_REQUEST_ERROR') {
    return 'request';
  }

  return 'provider';
}

export interface AgentContext {
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentInput<TPayload = Record<string, unknown>> {
  task: string;
  payload: TPayload;
  context?: AgentContext;
}

export interface AgentResult<TResult = unknown> {
  success: boolean;
  result: TResult;
  model?: string;
  latencyMs?: number;
}

export interface IAgent<TPayload = Record<string, unknown>, TResult = unknown> {
  readonly name: string;
  run(input: AgentInput<TPayload>): Promise<AgentResult<TResult>>;
}

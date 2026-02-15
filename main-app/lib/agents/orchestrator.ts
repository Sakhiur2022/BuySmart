import { AgentLogger } from "@/lib/agents/agent-logger";
import type { AgentContext, AgentInput, AgentResult, IAgent } from "@/lib/agents/types";

export interface PipelineStep<TPayload = Record<string, unknown>, TResult = unknown> {
  agent: IAgent<TPayload, TResult>;
  mapInput: (
    previousResult: AgentResult<unknown> | null,
    initialPayload: unknown,
    context?: AgentContext,
  ) => AgentInput<TPayload>;
}

export class AgentOrchestrator {
  private readonly registry = new Map<string, IAgent<any, any>>();
  private readonly logger: AgentLogger;

  constructor(logger: AgentLogger = new AgentLogger()) {
    this.logger = logger;
  }

  register(agent: IAgent<any, any>): void {
    this.registry.set(agent.name, agent);
  }

  registerMany(agents: IAgent<any, any>[]): void {
    agents.forEach((agent) => this.register(agent));
  }

  getAgent(name: string): IAgent<any, any> | undefined {
    return this.registry.get(name);
  }

  async dispatch<P, R>(task: string, payload: P, context?: AgentContext): Promise<AgentResult<R>> {
    const agent = this.getAgent(task) as IAgent<P, R> | undefined;

    if (!agent) {
      throw new Error(`No agent registered for task "${task}"`);
    }

    const input: AgentInput<P> = {
      task,
      payload,
      context,
    };

    const result = await agent.run(input);
    await this.logger.log({ agent, input, result });

    return result as AgentResult<R>;
  }

  async pipeline(
    steps: PipelineStep[],
    initialPayload: unknown,
    context?: AgentContext,
  ): Promise<AgentResult<unknown>[]> {
    const results: AgentResult<unknown>[] = [];
    let previous: AgentResult<unknown> | null = null;

    for (const step of steps) {
      const input = step.mapInput(previous, initialPayload, context);
      const result = await step.agent.run(input);
      await this.logger.log({ agent: step.agent, input, result });

      results.push(result);
      previous = result;

      if (!result.success) {
        break;
      }
    }

    return results;
  }
}

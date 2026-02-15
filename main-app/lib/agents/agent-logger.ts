import type { AgentInput, AgentResult, IAgent } from "@/lib/agents/types";
import { getServiceRoleSupabase } from "@/lib/supabase/service-role";
import type { Database, Json } from "@/lib/types/database.types";

interface AgentLogParams<TPayload, TResult> {
  agent: IAgent<TPayload, TResult>;
  input: AgentInput<TPayload>;
  result: AgentResult<TResult>;
}

type ActivityLogInsert = Database['public']['Tables']['activity_logs']['Insert'];

function toJson(value: unknown): Json | null {
  if (value === undefined) {
    return null;
  }

  try {
    return JSON.parse(JSON.stringify(value ?? null)) as Json;
  } catch {
    return null;
  }
}

function extractConfidence(result: unknown): number | null {
  if (
    result &&
    typeof result === 'object' &&
    'confidence' in result &&
    typeof (result as { confidence: unknown }).confidence === 'number'
  ) {
    return (result as { confidence: number }).confidence;
  }

  return null;
}

function extractErrorMessage(result: unknown): string | null {
  if (!result) {
    return null;
  }

  if (typeof result === 'string') {
    return result;
  }

  if (typeof result === 'object' && 'error' in result) {
    const errorValue = (result as { error: unknown }).error;
    if (typeof errorValue === 'string') {
      return errorValue;
    }

    try {
      return JSON.stringify(errorValue);
    } catch {
      return 'Unserializable agent error payload';
    }
  }

  return null;
}

export class AgentLogger {
  private readonly supabase = getServiceRoleSupabase();

  async log<TPayload, TResult>(params: AgentLogParams<TPayload, TResult>): Promise<void> {
    if (!this.supabase) {
      return;
    }

    const { agent, input, result } = params;
    const row: ActivityLogInsert = {
      activity_type: 'ai_action',
      action: 'agent_run',
      agent_name: agent.name,
      agent_version: agent.version ?? null,
      model_used: result.model ?? null,
      user_id: input.context?.userId ?? null,
      session_id: input.context?.sessionId ?? null,
      input_data: toJson(input.payload),
      output_data: toJson(result.result),
      confidence_score: extractConfidence(result.result),
      processing_time_ms: result.latencyMs ?? null,
      severity: result.success ? 'info' : 'error',
      status: result.success ? 'success' : 'failure',
      error_message: result.success ? null : extractErrorMessage(result.result),
      entity_type: 'agent',
      entity_id: null,
      metadata: toJson({
        task: input.task,
        cached: result.cached ?? false,
        contextMetadata: input.context?.metadata ?? null,
      }),
    };

    try {
      await this.supabase.from('activity_logs').insert(row);
    } catch (error) {
      console.error('Failed to write agent log', error);
    }
  }
}

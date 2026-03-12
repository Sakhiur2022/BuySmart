# AI-02 — AI Agent Architecture Design

> **Status**: Draft  
> **Created**: 2026-02-14  
> **Stack**: Next.js 15 · TypeScript · Supabase · Hugging Face Inference API · LangChain

---

## 1. Executive Summary

BuySmart embeds AI agents directly into its e-commerce platform to automate customer support, product recommendations, feedback analysis, and refund adjudication. All inference runs through the **Hugging Face Inference API** with **LangChain** orchestration, keeping the stack 100% open-source-model-friendly with no vendor lock-in to proprietary LLM providers.

This document defines the layered agent architecture, every planned agent, inter-agent communication, data flows, persistence strategy, and operational concerns (observability, error handling, rate limiting, caching).

---

## 2. Design Principles

| # | Principle | Rationale |
|---|-----------|-----------|
| 1 | **Single-responsibility agents** | Each agent owns exactly one domain task; composition happens at the orchestration layer. |
| 2 | **Typed contracts** | Every agent input/output is expressed as a TypeScript generic (`AgentInput<T>`, `AgentResult<T>`). |
| 3 | **Infrastructure transparency** | Agents are model-agnostic — they interact only with the AI service layer, never with HTTP details. |
| 4 | **Fail-safe defaults** | On error, agents return a normalized `AgentResult` with `success: false`; callers never receive unhandled throws. |
| 5 | **Observability first** | All agent runs are logged to `activity_logs` with latency, model name, input/output, and confidence. |
| 6 | **Cost-aware** | TTL caching and rate limiting are built into the service layer to prevent runaway API spend. |

---

## 3. High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                           │
│  Next.js App Router   (Server Components / Route Handlers / API)    │
└──────────────┬───────────────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                       CONTROLLER LAYER                              │
│  lib/controllers/*   (request validation, auth, response shaping)   │
└──────────────┬───────────────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     ORCHESTRATION LAYER                             │
│  AgentOrchestrator   (multi-agent routing, pipeline coordination)   │
└──────┬────────────┬────────────┬────────────┬───────────────────────┘
       │            │            │            │
       ▼            ▼            ▼            ▼
┌───────────┐┌───────────┐┌───────────┐┌───────────┐
│  Support  ││  Recom-   ││ Sentiment ││  Refund   │  ← AGENT LAYER
│  Agent    ││ mendation ││  Agent    ││  Agent    │    lib/agents/*
│           ││  Agent    ││           ││           │
└─────┬─────┘└─────┬─────┘└─────┬─────┘└─────┬─────┘
      │            │            │            │
      ▼            ▼            ▼            ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      AI SERVICE LAYER                               │
│  LangChain HF Chain · HF Client · Rate Limiter · TTL Cache         │
│  lib/services/ai/*                                                  │
└──────────────┬───────────────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────────────┐
│               EXTERNAL INFERENCE PROVIDERS                          │
│  Hugging Face Inference API  (Mixtral · Llama 3 · MiniLM · BART)   │
└──────────────────────────────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     DATA / PERSISTENCE LAYER                        │
│  Supabase Postgres  (activity_logs · feedback · refunds · configs)  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 4. Layer Breakdown

### 4.1 Presentation Layer

Next.js App Router pages and API route handlers. This layer is agent-unaware — it calls controllers and receives plain DTOs.

### 4.2 Controller Layer (`lib/controllers/`)

- Validates incoming request payloads (Zod).
- Extracts auth context from Supabase session.
- Delegates to the orchestration or service layer.
- Shapes the response (status codes, pagination, error envelope).

### 4.3 Orchestration Layer (`lib/agents/orchestrator.ts`)

The **AgentOrchestrator** is responsible for:

| Concern | Detail |
|---------|--------|
| **Routing** | Maps an incoming task name (e.g. `"analyze_feedback"`) to the correct agent class. |
| **Pipelines** | Chains multiple agents sequentially (e.g. Sentiment → Classification → Support). |
| **Context propagation** | Passes `AgentContext` (userId, sessionId, metadata) across agents in a pipeline. |
| **Logging** | After each agent run, writes to `activity_logs` with model, latency, confidence. |
| **Fallback** | If an agent returns `success: false`, the orchestrator can retry, fall back to a simpler model, or propagate the failure. |

### 4.4 Agent Layer (`lib/agents/`)

Every agent extends `BaseAgent<TPayload, TResult>` and implements:

```typescript
abstract readonly name: string;
protected abstract readonly systemPrompt: string;
protected abstract parseOutput(output: string): TResult;
```

The `BaseAgent.run()` method handles the full lifecycle:

1. Build a LangChain completion chain with the agent's system prompt.
2. Invoke the chain with serialized `payload`.
3. Measure latency.
4. Parse raw LLM output into strongly-typed `TResult`.
5. On error, normalise via `normalizeAIError()` and return a safe `AgentResult`.

### 4.5 AI Service Layer (`lib/services/ai/`)

Model-agnostic infrastructure providing:

| Module | Purpose |
|--------|---------|
| `config.ts` | Zod-validated env vars, `aiModels` registry |
| `hf-client.ts` | Low-level `invokeHuggingFaceModel<T>()` with auth, caching, retries |
| `langchain-hf.ts` | `createHFCompletionChain()` — PromptTemplate → LLM pipeline |
| `models/llm.ts` | `generateText()`, `generateChatCompletion()` |
| `models/sentiment.ts` | `analyzeSentiment()` — returns `AISentimentResponse` |
| `models/classification.ts` | `classifyText()` — zero-shot classification |
| `models/embeddings.ts` | `generateEmbedding()` — vector embeddings |
| `rate-limiter.ts` | `SimpleRateLimiter` — min-delay token bucket |
| `cache.ts` | `TTLCache<T>` — in-memory TTL store |
| `error-handler.ts` | Typed error hierarchy (`AIServiceError`, `AIConfigurationError`, `AIRequestError`, `AIResponseError`) |
| `utils.ts` | `runWithRetry()`, `approximateTokenCount()`, `buildChatPrompt()`, `buildStableCacheKey()` |

### 4.6 Data / Persistence Layer

Supabase Postgres tables used by agents:

| Table | Agent Interaction |
|-------|-------------------|
| `feedback` | Sentiment Agent writes `ai_sentiment`, `ai_category`, `ai_urgency`, `ai_keywords`, `ai_confidence_score` |
| `refunds` | Refund Agent writes `ai_recommendation`, `ai_risk_score`, `ai_analysis` |
| `activity_logs` | All agents log `agent_name`, `agent_version`, `model_used`, `input_data`, `output_data`, `confidence_score`, `processing_time_ms` |
| `ai_model_configs` | Admin-managed per-agent model configuration; agents read active config at startup |

---

## 5. Agent Catalogue

### 5.1 Support Agent

| Field | Value |
|-------|-------|
| **Class** | `SupportAgent extends BaseAgent<SupportPayload, SupportResult>` |
| **Prompt** | *"You are a customer support agent for an e-commerce marketplace. Give concise, policy-safe answers."* |
| **Input** | `{ question: string; orderContext?: OrderSnapshot; }` |
| **Output** | `{ answer: string; suggestedActions: string[]; confidence: number; }` |
| **Model** | `HF_CHAT_MODEL` (Meta-Llama-3-8B-Instruct) |
| **Caching** | None (responses are user-specific) |

### 5.2 Recommendation Agent

| Field | Value |
|-------|-------|
| **Class** | `RecommendationAgent extends BaseAgent<RecommendationPayload, RecommendationResult>` |
| **Prompt** | *"You are a recommendation assistant. Suggest relevant products based on user intent and constraints."* |
| **Input** | `{ userQuery: string; browsingHistory?: string[]; budget?: { min: number; max: number }; }` |
| **Output** | `{ recommendations: Array<{ productHint: string; reason: string; score: number }>; }` |
| **Model** | `HF_CHAT_MODEL` (Meta-Llama-3-8B-Instruct) |
| **Caching** | TTL 5 min (same query ↔ same results) |

### 5.3 Sentiment Agent

| Field | Value |
|-------|-------|
| **Class** | `SentimentAgent extends BaseAgent<SentimentPayload, SentimentResult>` |
| **Prompt** | *"You analyze customer feedback and extract sentiment, urgency, and key concerns."* |
| **Input** | `{ text: string; feedbackId: string; }` |
| **Output** | `{ sentiment: AISentimentLabel; urgency: AIUrgency; keywords: string[]; confidence: number; }` |
| **Model** | `HF_SENTIMENT_MODEL` (cardiffnlp/twitter-roberta-base-sentiment-latest) + `HF_CLASSIFICATION_MODEL` (facebook/bart-large-mnli) |
| **Caching** | TTL 10 min |
| **Side-effect** | Updates `feedback` row with AI columns |

### 5.4 Refund Agent

| Field | Value |
|-------|-------|
| **Class** | `RefundAgent extends BaseAgent<RefundPayload, RefundResult>` |
| **Prompt** | *"You evaluate refund requests and produce a recommendation with rationale and risk level."* |
| **Input** | `{ refundId: string; reason: RefundReasonEnum; amount: number; orderTotal: number; userHistory: UserRefundHistory; }` |
| **Output** | `{ decision: AIRefundDecision; riskScore: number; rationale: string; }` |
| **Model** | `HF_CHAT_MODEL` (Meta-Llama-3-8B-Instruct) |
| **Caching** | None (unique per request) |
| **Side-effect** | Updates `refunds` row with `ai_recommendation`, `ai_risk_score`, `ai_analysis` |

---

## 6. Type System

All agent types are defined in `lib/agents/types.ts`:

```typescript
// ── Core contracts ───────────────────────────────────────
interface AgentContext {
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

interface AgentInput<TPayload = Record<string, unknown>> {
  task: string;
  payload: TPayload;
  context?: AgentContext;
}

interface AgentResult<TResult = unknown> {
  success: boolean;
  result: TResult;
  model?: string;
  latencyMs?: number;
}

interface IAgent<TPayload = Record<string, unknown>, TResult = unknown> {
  readonly name: string;
  run(input: AgentInput<TPayload>): Promise<AgentResult<TResult>>;
}
```

Domain-specific payload and result types will be co-located with each agent class:

```
lib/agents/
  types.ts                   ← core contracts (existing)
  base-agent.ts              ← abstract BaseAgent (existing)
  prompts.ts                 ← AGENT_PROMPTS map (existing)
  orchestrator.ts            ← AgentOrchestrator (planned)
  support/
    support-agent.ts
    support.types.ts
  recommendation/
    recommendation-agent.ts
    recommendation.types.ts
  sentiment/
    sentiment-agent.ts
    sentiment.types.ts
  refund/
    refund-agent.ts
    refund.types.ts
```

---

## 7. Agent Lifecycle & Data Flow

### 7.1 Single-Agent Request Flow

```
Client ──► Route Handler ──► Controller
                                │
                           validates input (Zod)
                           extracts AgentContext from session
                                │
                                ▼
                          AgentOrchestrator.dispatch(task, payload, context)
                                │
                           resolves agent by task name
                                │
                                ▼
                          Agent.run({ task, payload, context })
                                │
                        ┌───────┴────────┐
                        │  BaseAgent     │
                        │  1. build chain│
                        │  2. invoke LLM │
                        │  3. parse      │
                        │  4. return     │
                        └───────┬────────┘
                                │
                                ▼
                          AgentResult<T>
                                │
                  ┌─────────────┴──────────────┐
                  │                            │
            update domain table          write activity_log
          (feedback / refunds)       (agent, model, latency)
                  │                            │
                  ▼                            ▼
            Controller shapes response → Route Handler → Client
```

### 7.2 Multi-Agent Pipeline Flow (Example: Feedback Processing)

```
Feedback Submitted
       │
       ▼
  SentimentAgent.run(text)
       │
       ├── sentiment: "negative"
       ├── urgency: "high"
       │
       ▼
  ClassificationAgent (via classifyText)
       │
       ├── category: "delivery"
       │
       ▼
  SupportAgent.run({ question: auto-generated, orderContext })
       │
       ├── suggestedActions: ["escalate_to_seller", "offer_tracking_update"]
       │
       ▼
  Orchestrator aggregates results
       │
       ├── update feedback row (ai_sentiment, ai_category, ai_urgency, ai_keywords)
       ├── insert activity_log per agent step
       │
       ▼
  Return composite result to controller
```

---

## 8. Orchestrator Design

```typescript
// lib/agents/orchestrator.ts  (planned)

interface PipelineStep {
  agent: IAgent<any, any>;
  mapInput: (prevResult: any, originalPayload: any) => AgentInput<any>;
}

class AgentOrchestrator {
  private registry = new Map<string, IAgent>();

  register(agent: IAgent): void {
    this.registry.set(agent.name, agent);
  }

  /** Dispatch a single agent by task name. */
  async dispatch<P, R>(
    task: string,
    payload: P,
    context?: AgentContext,
  ): Promise<AgentResult<R>> {
    const agent = this.registry.get(task);
    if (!agent) throw new Error(`No agent registered for task "${task}"`);

    const result = await agent.run({ task, payload, context });
    await this.log(agent.name, payload, result, context);
    return result as AgentResult<R>;
  }

  /** Run a multi-step pipeline and return aggregated results. */
  async pipeline(
    steps: PipelineStep[],
    initialPayload: unknown,
    context?: AgentContext,
  ): Promise<AgentResult<unknown>[]> {
    const results: AgentResult<unknown>[] = [];
    let prevResult: unknown = null;

    for (const step of steps) {
      const input = step.mapInput(prevResult, initialPayload);
      const result = await step.agent.run(input);
      await this.log(step.agent.name, input, result, context);
      results.push(result);
      prevResult = result.result;
    }

    return results;
  }

  private async log(
    agentName: string,
    input: unknown,
    result: AgentResult<unknown>,
    context?: AgentContext,
  ): Promise<void> {
    // Insert into activity_logs via Supabase
  }
}
```

---

## 9. Model Registry

Models are configured per-environment in `.env.local` and validated at startup by Zod (`aiEnvSchema`).

| Logical Slot | Default Model | Task |
|--------------|---------------|------|
| `HF_LLM_MODEL` | `mistralai/Mixtral-8x7B-Instruct-v0.1` | Text generation |
| `HF_CHAT_MODEL` | `meta-llama/Meta-Llama-3-8B-Instruct` | Chat / agent reasoning |
| `HF_EMBEDDING_MODEL` | `sentence-transformers/all-MiniLM-L6-v2` | Vector embeddings |
| `HF_SENTIMENT_MODEL` | `cardiffnlp/twitter-roberta-base-sentiment-latest` | Sentiment analysis |
| `HF_CLASSIFICATION_MODEL` | `facebook/bart-large-mnli` | Zero-shot classification |

Runtime model swapping is supported via the `ai_model_configs` table — an admin can activate a different model for a specific agent, and the orchestrator reads active config on each dispatch.

---

## 10. Cross-Cutting Concerns

### 10.1 Error Handling

```
AIServiceError (base)
├── AIConfigurationError   – missing API key / invalid env
├── AIRequestError         – HF API HTTP error (status code preserved)
└── AIResponseError        – empty or malformed model output
```

`normalizeAIError()` converts any thrown value into the hierarchy above.  
`BaseAgent.run()` catches all errors and returns `AgentResult { success: false }` — callers never receive raw exceptions.

### 10.2 Rate Limiting

`SimpleRateLimiter` enforces a minimum inter-request delay (`HF_RATE_LIMIT_DELAY`, default 100 ms) to stay within Hugging Face free-tier quotas.

### 10.3 Caching

`TTLCache<T>` provides in-memory caching keyed by `model + JSON.stringify(payload)`.

| Model Type | Default TTL |
|------------|-------------|
| Sentiment | 10 min |
| Classification | 10 min |
| Embeddings | 15 min |
| Text generation | No cache (user-specific) |

### 10.4 Retry Strategy

`runWithRetry()` implements linear back-off:

- Up to `HF_MAX_RETRIES` (default 3) attempts.
- Delay = `250ms × attempt`.
- Exhausted retries re-throw the original error.

### 10.5 Observability

Every agent invocation produces an `activity_logs` row:

| Column | Source |
|--------|--------|
| `agent_name` | `agent.name` |
| `agent_version` | Semantic version from config |
| `model_used` | Model ID from `aiModels` |
| `input_data` | Serialized `AgentInput.payload` (JSONB) |
| `output_data` | Serialized `AgentResult.result` (JSONB) |
| `confidence_score` | Agent-reported confidence |
| `processing_time_ms` | Wall-clock latency |
| `severity` | `info` on success, `error` on failure |
| `status` | `success` / `failure` |

### 10.6 Security

- **RLS enforced**: `activity_logs` and `ai_model_configs` are admin-only.
- AI-generated fields on `feedback` and `refunds` are write-protected from non-service roles.
- `HUGGINGFACE_API_KEY` is server-side only (validated at startup, never exposed to the client).

---

## 11. Database Schema (AI-Relevant Subset)

### 11.1 AI Enums

```sql
ai_sentiment_enum       → 'positive' | 'neutral' | 'negative' | 'mixed'
ai_feedback_category_enum → 'product_quality' | 'delivery' | 'customer_service' | 'pricing' | 'user_experience' | 'other'
ai_urgency_enum          → 'low' | 'medium' | 'high' | 'critical'
ai_refund_decision_enum  → 'auto_approve' | 'manual_review' | 'auto_reject'
```

### 11.2 AI-Enriched Columns on `feedback`

| Column | Type | Written By |
|--------|------|-----------|
| `ai_sentiment` | `ai_sentiment_enum` | Sentiment Agent |
| `ai_category` | `ai_feedback_category_enum` | Classification (via Sentiment Agent pipeline) |
| `ai_urgency` | `ai_urgency_enum` | Sentiment Agent |
| `ai_keywords` | `text[]` | Sentiment Agent |
| `ai_processed_at` | `timestamptz` | Orchestrator |
| `ai_confidence_score` | `numeric(3,2)` | Sentiment Agent |

### 11.3 AI-Enriched Columns on `refunds`

| Column | Type | Written By |
|--------|------|-----------|
| `ai_recommendation` | `ai_refund_decision_enum` | Refund Agent |
| `ai_risk_score` | `numeric(3,2)` | Refund Agent |
| `ai_analysis` | `jsonb` | Refund Agent |
| `ai_processed_at` | `timestamptz` | Orchestrator |

### 11.4 `ai_model_configs` Table

```sql
config_id          bigserial PK
agent_name         varchar(100) NOT NULL
model_name         varchar(100) NOT NULL
version            varchar(20)  NOT NULL
configuration      jsonb        NOT NULL   -- temperature, maxTokens, topP, etc.
is_active          boolean      DEFAULT true
performance_metrics jsonb                  -- last benchmark results
created_at         timestamptz
updated_at         timestamptz
UNIQUE (agent_name, is_active) DEFERRABLE
```

---

## 12. Directory Structure (Target)

```
lib/agents/
├── base-agent.ts                    # Abstract base class (exists)
├── prompts.ts                       # Prompt constants (exists)
├── types.ts                         # Core contracts (exists)
├── orchestrator.ts                  # Multi-agent orchestrator (planned)
├── agent-logger.ts                  # activity_logs writer (planned)
├── support/
│   ├── support-agent.ts             # SupportAgent class
│   └── support.types.ts             # SupportPayload, SupportResult
├── recommendation/
│   ├── recommendation-agent.ts      # RecommendationAgent class
│   └── recommendation.types.ts      # RecommendationPayload, RecommendationResult
├── sentiment/
│   ├── sentiment-agent.ts           # SentimentAgent class
│   └── sentiment.types.ts           # SentimentPayload, SentimentResult
└── refund/
    ├── refund-agent.ts              # RefundAgent class
    └── refund.types.ts              # RefundPayload, RefundResult
```

---

## 13. Extension Points

| Capability | Mechanism |
|-----------|-----------|
| **Add a new agent** | Create a new folder under `lib/agents/`, extend `BaseAgent`, register with the orchestrator. |
| **Swap model** | Update env var or insert a new row in `ai_model_configs` and deactivate the old one. |
| **Add pipeline** | Define a `PipelineStep[]` array and call `orchestrator.pipeline()`. |
| **Custom caching** | Replace `TTLCache` with Redis/Upstash adapter implementing the same `get`/`set`/`clear` interface. |
| **Streaming responses** | Extend `BaseAgent` with a `runStream()` method that yields Server-Sent Events via `ReadableStream`. |
| **Guardrails** | Insert a pre-processing step in the orchestrator to validate/sanitise agent inputs before dispatch. |

---

## 14. Future Considerations

1. **Vector Search** — Store product embeddings (via `generateEmbedding()`) in a pgvector column for semantic product search and recommendation enrichment.
2. **Conversation Memory** — Add a `conversations` table to persist multi-turn agent dialogue for the Support Agent.
3. **A/B Model Testing** — Use `ai_model_configs` versioning to run parallel model variants and compare via `performance_metrics`.
4. **Edge Caching** — Promote `TTLCache` to a distributed cache (Upstash Redis) for multi-instance deployments.
5. **Agent Evaluation** — Automated benchmark suite (`benchmark.ts`) extended to run on CI and gate deployments on latency/accuracy regressions.
6. **Human-in-the-Loop** — Refund Agent decisions with `manual_review` recommendation trigger a notification workflow for admin review.

---

## 15. Glossary

| Term | Definition |
|------|-----------|
| **Agent** | A single-purpose AI component that accepts typed input, invokes inference, and returns typed output. |
| **Orchestrator** | Coordinator that routes tasks to agents and manages pipelines. |
| **Pipeline** | An ordered sequence of agent invocations where each step's output feeds the next step's input. |
| **System Prompt** | A static instruction string prepended to every LLM call for a given agent. |
| **TTL Cache** | In-memory key/value store with time-to-live expiry. |
| **Normalised Error** | An error converted to the `AIServiceError` hierarchy for consistent handling. |

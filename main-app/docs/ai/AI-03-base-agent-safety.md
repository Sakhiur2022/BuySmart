# AI-03 — Base Agent Class with Safety Constraints

> **Status**: Draft  
> **Created**: 2026-02-14  
> **Depends On**: AI-02 (Agent Architecture)  
> **Stack**: TypeScript · Zod · BaseAgent · Supabase

---

## 1. Executive Summary

The current `BaseAgent` implementation provides minimal error handling but lacks comprehensive safety guardrails required for production AI systems. This design introduces a multi-layered safety architecture that protects against:

- **Prompt injection** and adversarial inputs
- **Excessive costs** from long inputs or output generation
- **PII leakage** in logs and responses
- **Harmful content** generation
- **Service abuse** through rate limiting
- **Cascading failures** via circuit breakers
- **Unaudited operations** via comprehensive logging

All safety constraints are **configuration-driven**, **overridable per agent**, and **fully observable** through structured logging.

---

## 2. Design Goals

| # | Goal | Success Criteria |
|---|------|------------------|
| 1 | **Defense in Depth** | Multiple independent safety layers; failure of one layer doesn't compromise the system |
| 2 | **Zero Trust Inputs** | All user-provided data is validated, sanitized, and size-limited before processing |
| 3 | **Cost Predictability** | Configurable hard limits on tokens, execution time, and API calls per user/session |
| 4 | **Privacy by Default** | Automatic PII detection and redaction in logs; opt-in for retention |
| 5 | **Graceful Degradation** | Safety violations return informative errors without crashing the agent |
| 6 | **Auditability** | Every safety check (pass or fail) is logged with context for forensic analysis |
| 7 | **Developer Ergonomics** | Safety is transparent to agent implementers; constraints are declarative |

---

## 3. Threat Model

### 3.1 Adversarial Inputs

| Threat | Attack Vector | Impact | Mitigation |
|--------|---------------|--------|------------|
| **Prompt Injection** | User crafts input to override system instructions (e.g., "Ignore previous instructions and...") | Agent behaves outside policy; data exfiltration | Input sanitization, keyword detection, system prompt isolation |
| **Payload Bombed Inputs** | Extremely long or deeply nested JSON payloads | OOM crash, excessive tokens, API quota exhaustion | Size limits, depth limits, token pre-estimation |
| **Malicious Code Execution** | Input contains executable code (SQL, shell, JS) | Injection attack if agent output is eval'd downstream | Output escaping, syntax detection, allow-lists |

### 3.2 Resource Exhaustion

| Threat | Attack Vector | Impact | Mitigation |
|--------|---------------|--------|------------|
| **Token Flooding** | User submits max-length inputs repeatedly | API quota depletion, cost overrun | Per-user rate limits, token budgets |
| **Infinite Loops** | Agent pipeline enters circular dependency | Timeout, hung requests | Max execution time, circuit breakers |
| **Model Overload** | Concurrent requests exceed model capacity | 429 errors, degraded service | Request queuing, backpressure, load shedding |

### 3.3 Data Privacy

| Threat | Attack Vector | Impact | Mitigation |
|--------|---------------|--------|------------|
| **PII Leakage** | User input contains SSN, credit cards, emails; system logs them | GDPR/CCPA violation, security breach | PII detection, automatic redaction in logs |
| **Sensitive Data in Context** | Agent includes order details in prompt sent to external LLM | Data exfiltration to third-party | Data minimization, encryption in transit, approved processors only |
| **Verbose Error Messages** | Stack traces expose internal paths, API keys | Information disclosure | Error message sanitization, admin-only debug mode |

### 3.4 Content Safety

| Threat | Attack Vector | Impact | Mitigation |
|--------|---------------|--------|------------|
| **Harmful Output** | Agent generates violent, hateful, or illegal content | Brand damage, legal liability | Output moderation, keyword filters, model alignment |
| **Bias Amplification** | Agent repeats or reinforces discriminatory patterns | Reputational harm, user distrust | Fairness testing, bias detection, human oversight for sensitive domains |

---

## 4. Safety Architecture

### 4.1 Layered Defense Model

```
User Input
    │
    ▼
┌────────────────────────────────────────────────┐
│  Layer 1: PRE-VALIDATION                      │
│  • Schema validation (Zod)                     │
│  • Size limits (max chars, max depth)         │
│  • Type coercion & normalization               │
└────────────┬───────────────────────────────────┘
             │ ✓ Valid
             ▼
┌────────────────────────────────────────────────┐
│  Layer 2: INPUT SANITIZATION                  │
│  • Prompt injection detection                  │
│  • PII detection & redaction                   │
│  • Malicious pattern filtering                 │
│  • Token estimation & budget check             │
└────────────┬───────────────────────────────────┘
             │ ✓ Safe
             ▼
┌────────────────────────────────────────────────┐
│  Layer 3: RATE LIMITING                       │
│  • Per-user request quota                      │
│  • Per-agent concurrency limit                 │
│  • Token budget enforcement                    │
└────────────┬───────────────────────────────────┘
             │ ✓ Within limits
             ▼
┌────────────────────────────────────────────────┐
│  Layer 4: EXECUTION CONTROL                   │
│  • Timeout enforcement (AbortController)       │
│  • Circuit breaker (fail-fast on repeated errors) │
│  • Execution context isolation                 │
└────────────┬───────────────────────────────────┘
             │ ✓ Executed
             ▼
┌────────────────────────────────────────────────┐
│  Layer 5: OUTPUT VALIDATION                   │
│  • Content safety moderation                   │
│  • Format validation                           │
│  • PII scrubbing before logging                │
│  • Length limits                               │
└────────────┬───────────────────────────────────┘
             │ ✓ Safe output
             ▼
┌────────────────────────────────────────────────┐
│  Layer 6: AUDIT LOGGING                       │
│  • Log all safety checks (pass/fail)          │
│  • Record violations with severity             │
│  • Emit metrics for monitoring                 │
└────────────┬───────────────────────────────────┘
             │
             ▼
         AgentResult
```

---

## 5. Safety Configuration Schema

All safety constraints are defined declaratively via `AgentSafetyPolicy`:

```typescript
interface AgentSafetyPolicy {
  /** Input validation rules */
  input: {
    maxChars: number;              // Default: 10000
    maxTokens: number;             // Default: 2000 (estimated)
    maxDepth: number;              // Max JSON nesting level
    allowedContentTypes?: string[]; // e.g., ["text/plain", "application/json"]
    rejectPatterns?: RegExp[];     // Patterns that trigger instant rejection
  };

  /** Output validation rules */
  output: {
    maxChars: number;              // Default: 5000
    maxTokens: number;             // Default: 1500
    contentModerationEnabled: boolean; // Default: true
    allowHtml: boolean;            // Default: false
  };

  /** Rate limiting */
  rateLimits: {
    maxRequestsPerMinute: number;  // Per user + agent
    maxConcurrentRequests: number; // Per agent instance
    tokenBudgetPerHour: number;    // Prevents cost spirals
  };

  /** Execution controls */
  execution: {
    timeoutMs: number;             // Default: 30000 (30s)
    enableCircuitBreaker: boolean; // Default: true
    circuitBreakerThreshold: number; // Failures before open
    circuitBreakerResetMs: number;   // Time before retry
  };

  /** Privacy controls */
  privacy: {
    detectPII: boolean;            // Default: true
    redactPIIInLogs: boolean;      // Default: true
    redactPIIInOutput: boolean;    // Default: false (user-facing)
    retentionDays?: number;        // Auto-delete logs after N days
  };

  /** Audit settings */
  audit: {
    logAllRequests: boolean;       // Default: true
    logInputPayload: boolean;      // Default: false (privacy)
    logOutputResult: boolean;      // Default: false (privacy)
    logOnlyViolations: boolean;    // Default: false
  };
}
```

### 5.1 Default Safety Policy

```typescript
// lib/agents/safety/default-policy.ts
const DEFAULT_SAFETY_POLICY: AgentSafetyPolicy = {
  input: {
    maxChars: 10000,
    maxTokens: 2000,
    maxDepth: 5,
    rejectPatterns: [
      /ignore (previous|all) instructions/gi,
      /disregard (system|earlier) prompt/gi,
      /print (your|the) (system|prompt)/gi,
    ],
  },
  output: {
    maxChars: 5000,
    maxTokens: 1500,
    contentModerationEnabled: true,
    allowHtml: false,
  },
  rateLimits: {
    maxRequestsPerMinute: 10,
    maxConcurrentRequests: 3,
    tokenBudgetPerHour: 50000,
  },
  execution: {
    timeoutMs: 30000,
    enableCircuitBreaker: true,
    circuitBreakerThreshold: 5,
    circuitBreakerResetMs: 60000,
  },
  privacy: {
    detectPII: true,
    redactPIIInLogs: true,
    redactPIIInOutput: false,
  },
  audit: {
    logAllRequests: true,
    logInputPayload: false,
    logOutputResult: false,
    logOnlyViolations: false,
  },
};
```

---

## 6. Enhanced BaseAgent Implementation

### 6.1 New Class Structure

```typescript
// lib/agents/base-agent.ts (enhanced)

import type { AgentInput, AgentResult } from "@/lib/agents/types";
import type { AgentSafetyPolicy } from "@/lib/agents/safety/types";
import { DEFAULT_SAFETY_POLICY } from "@/lib/agents/safety/default-policy";
import { SafetyGuard } from "@/lib/agents/safety/guard";
import { CircuitBreaker } from "@/lib/agents/safety/circuit-breaker";
import { AgentRateLimiter } from "@/lib/agents/safety/rate-limiter";
import { SafetyLogger } from "@/lib/agents/safety/logger";

export abstract class BaseAgent<TPayload = Record<string, unknown>, TResult = unknown> {
  abstract readonly name: string;
  protected abstract readonly systemPrompt: string;
  protected abstract parseOutput(output: string): TResult;

  /** Override to customize safety policy per agent */
  protected readonly safetyPolicy: AgentSafetyPolicy = DEFAULT_SAFETY_POLICY;

  private readonly guard: SafetyGuard;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly rateLimiter: AgentRateLimiter;
  private readonly logger: SafetyLogger;

  constructor() {
    this.guard = new SafetyGuard(this.safetyPolicy);
    this.circuitBreaker = new CircuitBreaker(
      this.safetyPolicy.execution.circuitBreakerThreshold,
      this.safetyPolicy.execution.circuitBreakerResetMs,
    );
    this.rateLimiter = new AgentRateLimiter(this.name, this.safetyPolicy.rateLimits);
    this.logger = new SafetyLogger(this.name, this.safetyPolicy.audit);
  }

  async run(input: AgentInput<TPayload>): Promise<AgentResult<TResult>> {
    const startedAt = performance.now();
    const userId = input.context?.userId;
    const sessionId = input.context?.sessionId;

    // ── Layer 1: Pre-validation ────────────────────────
    const preValidation = this.guard.validateInput(input.payload);
    if (!preValidation.valid) {
      await this.logger.logViolation("PRE_VALIDATION", preValidation.reason, { input });
      return this.safetyViolationResult(preValidation.reason);
    }

    // ── Layer 2: Input sanitization ────────────────────
    const sanitized = await this.guard.sanitizeInput(input.payload, userId);
    if (!sanitized.safe) {
      await this.logger.logViolation("SANITIZATION", sanitized.reason, { input });
      return this.safetyViolationResult(sanitized.reason);
    }

    // ── Layer 3: Rate limiting ─────────────────────────
    const rateLimitCheck = await this.rateLimiter.checkQuota(userId, sessionId);
    if (!rateLimitCheck.allowed) {
      await this.logger.logViolation("RATE_LIMIT", rateLimitCheck.reason, { userId });
      return this.safetyViolationResult("Rate limit exceeded. Try again later.");
    }

    // ── Layer 4: Circuit breaker ───────────────────────
    if (this.safetyPolicy.execution.enableCircuitBreaker && this.circuitBreaker.isOpen()) {
      await this.logger.logViolation("CIRCUIT_OPEN", "Circuit breaker is open", { agent: this.name });
      return this.safetyViolationResult("Service temporarily unavailable.");
    }

    // ── Layer 4: Execution with timeout ────────────────
    try {
      const abortController = new AbortController();
      const timeoutId = setTimeout(
        () => abortController.abort(),
        this.safetyPolicy.execution.timeoutMs,
      );

      const chain = createHFCompletionChain(this.systemPrompt);
      const rawOutput = await chain.invoke({
        input: JSON.stringify(sanitized.data),
        signal: abortController.signal,
      });

      clearTimeout(timeoutId);

      // ── Layer 5: Output validation ─────────────────────
      const outputValidation = await this.guard.validateOutput(rawOutput);
      if (!outputValidation.valid) {
        await this.logger.logViolation("OUTPUT_VALIDATION", outputValidation.reason, { rawOutput });
        return this.safetyViolationResult("Output failed safety checks.");
      }

      const parsedResult = this.parseOutput(outputValidation.data);
      const latencyMs = Math.round(performance.now() - startedAt);

      // ── Layer 6: Audit logging ─────────────────────────
      await this.logger.logSuccess({
        agent: this.name,
        userId,
        sessionId,
        latencyMs,
        inputTokens: sanitized.estimatedTokens,
        outputTokens: approximateTokenCount(rawOutput),
      });

      // Record success for circuit breaker
      this.circuitBreaker.recordSuccess();

      return {
        success: true,
        result: parsedResult,
        latencyMs,
      };

    } catch (error) {
      const latencyMs = Math.round(performance.now() - startedAt);

      // Record failure for circuit breaker
      this.circuitBreaker.recordFailure();

      if (error instanceof Error && error.name === "AbortError") {
        await this.logger.logViolation("TIMEOUT", `Execution exceeded ${this.safetyPolicy.execution.timeoutMs}ms`, { error });
        return this.safetyViolationResult("Request timed out.");
      }

      const normalized = normalizeAIError(error);
      await this.logger.logError(normalized, { userId, sessionId, latencyMs });

      return {
        success: false,
        result: this.parseOutput(normalized.message),
      };
    }
  }

  private safetyViolationResult(message: string): AgentResult<TResult> {
    return {
      success: false,
      result: { error: message } as TResult,
    };
  }
}
```

---

## 7. Safety Components

### 7.1 SafetyGuard

```typescript
// lib/agents/safety/guard.ts

export class SafetyGuard {
  constructor(private readonly policy: AgentSafetyPolicy) {}

  /** Layer 1: Pre-validation */
  validateInput(payload: unknown): ValidationResult {
    // Size checks
    const serialized = JSON.stringify(payload);
    if (serialized.length > this.policy.input.maxChars) {
      return { valid: false, reason: `Input exceeds ${this.policy.input.maxChars} characters` };
    }

    // Depth check
    if (this.getJsonDepth(payload) > this.policy.input.maxDepth) {
      return { valid: false, reason: `Input nesting exceeds ${this.policy.input.maxDepth} levels` };
    }

    // Token estimation
    const estimatedTokens = approximateTokenCount(serialized);
    if (estimatedTokens > this.policy.input.maxTokens) {
      return { valid: false, reason: `Input exceeds ${this.policy.input.maxTokens} tokens` };
    }

    return { valid: true };
  }

  /** Layer 2: Sanitization */
  async sanitizeInput(payload: unknown, userId?: string): Promise<SanitizationResult> {
    const serialized = JSON.stringify(payload);

    // Prompt injection detection
    if (this.policy.input.rejectPatterns) {
      for (const pattern of this.policy.input.rejectPatterns) {
        if (pattern.test(serialized)) {
          return { safe: false, reason: "Input contains prohibited patterns" };
        }
      }
    }

    // PII detection
    let sanitizedData = payload;
    if (this.policy.privacy.detectPII) {
      const piiDetected = this.detectPII(serialized);
      if (piiDetected.hasPII) {
        // Log violation but don't reject (redact instead)
        sanitizedData = this.redactPII(payload, piiDetected.matches);
      }
    }

    const estimatedTokens = approximateTokenCount(JSON.stringify(sanitizedData));

    return {
      safe: true,
      data: sanitizedData,
      estimatedTokens,
    };
  }

  /** Layer 5: Output validation */
  async validateOutput(output: string): Promise<ValidationResult> {
    // Length check
    if (output.length > this.policy.output.maxChars) {
      return { valid: false, reason: "Output too long" };
    }

    // Token check
    const tokens = approximateTokenCount(output);
    if (tokens > this.policy.output.maxTokens) {
      return { valid: false, reason: "Output exceeds token limit" };
    }

    // Content moderation
    if (this.policy.output.contentModerationEnabled) {
      const moderationResult = await this.moderateContent(output);
      if (!moderationResult.safe) {
        return { valid: false, reason: moderationResult.reason };
      }
    }

    // HTML check
    if (!this.policy.output.allowHtml && this.containsHtml(output)) {
      return { valid: false, reason: "Output contains HTML" };
    }

    return { valid: true, data: output };
  }

  private detectPII(text: string): PIIDetectionResult {
    const patterns = {
      email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
      ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
      creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    };

    const matches: PIIMatch[] = [];
    for (const [type, pattern] of Object.entries(patterns)) {
      const found = text.match(pattern);
      if (found) {
        matches.push({ type, values: found });
      }
    }

    return { hasPII: matches.length > 0, matches };
  }

  private redactPII(data: unknown, matches: PIIMatch[]): unknown {
    let serialized = JSON.stringify(data);
    for (const match of matches) {
      for (const value of match.values) {
        serialized = serialized.replace(value, `[REDACTED_${match.type.toUpperCase()}]`);
      }
    }
    return JSON.parse(serialized);
  }

  private async moderateContent(text: string): Promise<ModerationResult> {
    // Keyword-based filtering (fast path)
    const prohibitedKeywords = [
      "violence", "hate", "illegal", "explicit"
      // Expand based on policy
    ];

    const lowerText = text.toLowerCase();
    for (const keyword of prohibitedKeywords) {
      if (lowerText.includes(keyword)) {
        return { safe: false, reason: "Content flagged by keyword filter" };
      }
    }

    // Future: call external moderation API (OpenAI Moderation, Perspective API)
    return { safe: true };
  }

  private containsHtml(text: string): boolean {
    return /<[^>]+>/g.test(text);
  }

  private getJsonDepth(obj: unknown, depth = 0): number {
    if (depth > 20) return depth; // Prevent stack overflow
    if (typeof obj !== "object" || obj === null) return depth;
    const depths = Object.values(obj).map(val => this.getJsonDepth(val, depth + 1));
    return Math.max(depth, ...depths);
  }
}
```

### 7.2 CircuitBreaker

```typescript
// lib/agents/safety/circuit-breaker.ts

type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export class CircuitBreaker {
  private state: CircuitState = "CLOSED";
  private failureCount = 0;
  private lastFailureTime = 0;

  constructor(
    private readonly threshold: number,
    private readonly resetMs: number,
  ) {}

  isOpen(): boolean {
    if (this.state === "OPEN") {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed > this.resetMs) {
        this.state = "HALF_OPEN";
        this.failureCount = 0;
        return false;
      }
      return true;
    }
    return false;
  }

  recordSuccess(): void {
    if (this.state === "HALF_OPEN") {
      this.state = "CLOSED";
    }
    this.failureCount = 0;
  }

  recordFailure(): void {
    this.failureCount += 1;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.threshold) {
      this.state = "OPEN";
    }
  }

  getState(): CircuitState {
    return this.state;
  }
}
```

### 7.3 AgentRateLimiter

```typescript
// lib/agents/safety/rate-limiter.ts

interface RateLimitBucket {
  requests: number[];
  tokens: number[];
  concurrent: number;
}

export class AgentRateLimiter {
  private buckets = new Map<string, RateLimitBucket>();

  constructor(
    private readonly agentName: string,
    private readonly limits: AgentSafetyPolicy["rateLimits"],
  ) {}

  async checkQuota(userId?: string, sessionId?: string): Promise<RateLimitCheckResult> {
    const key = this.buildKey(userId, sessionId);
    const bucket = this.getBucket(key);
    const now = Date.now();

    // Clean expired entries
    bucket.requests = bucket.requests.filter(ts => now - ts < 60000); // 1 min window
    bucket.tokens = bucket.tokens.filter(ts => now - ts < 3600000);  // 1 hour window

    // Check request rate
    if (bucket.requests.length >= this.limits.maxRequestsPerMinute) {
      return { allowed: false, reason: "Request rate limit exceeded" };
    }

    // Check concurrency
    if (bucket.concurrent >= this.limits.maxConcurrentRequests) {
      return { allowed: false, reason: "Too many concurrent requests" };
    }

    // Check token budget
    const tokenSum = bucket.tokens.reduce((sum, val) => sum + val, 0);
    if (tokenSum >= this.limits.tokenBudgetPerHour) {
      return { allowed: false, reason: "Hourly token budget exceeded" };
    }

    // Record usage
    bucket.requests.push(now);
    bucket.concurrent += 1;

    return { allowed: true };
  }

  recordTokenUsage(userId: string | undefined, sessionId: string | undefined, tokens: number): void {
    const key = this.buildKey(userId, sessionId);
    const bucket = this.getBucket(key);
    bucket.tokens.push(tokens);
  }

  releaseSlot(userId: string | undefined, sessionId: string | undefined): void {
    const key = this.buildKey(userId, sessionId);
    const bucket = this.getBucket(key);
    bucket.concurrent = Math.max(0, bucket.concurrent - 1);
  }

  private buildKey(userId?: string, sessionId?: string): string {
    return `${this.agentName}:${userId || "anon"}:${sessionId || "default"}`;
  }

  private getBucket(key: string): RateLimitBucket {
    if (!this.buckets.has(key)) {
      this.buckets.set(key, { requests: [], tokens: [], concurrent: 0 });
    }
    return this.buckets.get(key)!;
  }
}
```

### 7.4 SafetyLogger

```typescript
// lib/agents/safety/logger.ts

export class SafetyLogger {
  constructor(
    private readonly agentName: string,
    private readonly auditPolicy: AgentSafetyPolicy["audit"],
  ) {}

  async logViolation(
    layer: string,
    reason: string,
    context: Record<string, unknown>,
  ): Promise<void> {
    if (!this.auditPolicy.logAllRequests && !this.auditPolicy.logOnlyViolations) {
      return;
    }

    const supabase = createServiceClient();
    await supabase.from("activity_logs").insert({
      agent_name: this.agentName,
      activity_type: "ai_action",
      action: "safety_violation",
      severity: "warning",
      status: "failure",
      metadata: {
        layer,
        reason,
        ...context,
      },
    });
  }

  async logSuccess(metrics: {
    agent: string;
    userId?: string;
    sessionId?: string;
    latencyMs: number;
    inputTokens?: number;
    outputTokens?: number;
  }): Promise<void> {
    if (!this.auditPolicy.logAllRequests) {
      return;
    }

    const supabase = createServiceClient();
    await supabase.from("activity_logs").insert({
      agent_name: metrics.agent,
      user_id: metrics.userId,
      session_id: metrics.sessionId,
      activity_type: "ai_action",
      action: "agent_run",
      processing_time_ms: metrics.latencyMs,
      severity: "info",
      status: "success",
      metadata: {
        inputTokens: metrics.inputTokens,
        outputTokens: metrics.outputTokens,
      },
    });
  }

  async logError(
    error: AIServiceError,
    context: Record<string, unknown>,
  ): Promise<void> {
    const supabase = createServiceClient();
    await supabase.from("activity_logs").insert({
      agent_name: this.agentName,
      activity_type: "ai_action",
      action: "agent_error",
      severity: "error",
      status: "failure",
      error_message: error.message,
      metadata: context,
    });
  }
}
```

---

## 8. Type Definitions

```typescript
// lib/agents/safety/types.ts

export interface ValidationResult {
  valid: boolean;
  reason?: string;
  data?: unknown;
}

export interface SanitizationResult {
  safe: boolean;
  reason?: string;
  data?: unknown;
  estimatedTokens?: number;
}

export interface RateLimitCheckResult {
  allowed: boolean;
  reason?: string;
  retryAfterMs?: number;
}

export interface PIIMatch {
  type: string;
  values: string[];
}

export interface PIIDetectionResult {
  hasPII: boolean;
  matches: PIIMatch[];
}

export interface ModerationResult {
  safe: boolean;
  reason?: string;
  categories?: string[];
}

export interface AgentSafetyPolicy {
  input: {
    maxChars: number;
    maxTokens: number;
    maxDepth: number;
    allowedContentTypes?: string[];
    rejectPatterns?: RegExp[];
  };
  output: {
    maxChars: number;
    maxTokens: number;
    contentModerationEnabled: boolean;
    allowHtml: boolean;
  };
  rateLimits: {
    maxRequestsPerMinute: number;
    maxConcurrentRequests: number;
    tokenBudgetPerHour: number;
  };
  execution: {
    timeoutMs: number;
    enableCircuitBreaker: boolean;
    circuitBreakerThreshold: number;
    circuitBreakerResetMs: number;
  };
  privacy: {
    detectPII: boolean;
    redactPIIInLogs: boolean;
    redactPIIInOutput: boolean;
    retentionDays?: number;
  };
  audit: {
    logAllRequests: boolean;
    logInputPayload: boolean;
    logOutputResult: boolean;
    logOnlyViolations: boolean;
  };
}
```

---

## 9. Per-Agent Policy Overrides

Agents can override the default policy:

```typescript
// lib/agents/refund/refund-agent.ts

export class RefundAgent extends BaseAgent<RefundPayload, RefundResult> {
  readonly name = "refund";
  protected readonly systemPrompt = AGENT_PROMPTS.refund;

  // Stricter policy for financial decisions
  protected readonly safetyPolicy: AgentSafetyPolicy = {
    ...DEFAULT_SAFETY_POLICY,
    input: {
      ...DEFAULT_SAFETY_POLICY.input,
      maxTokens: 1000, // Shorter for structured refund data
    },
    rateLimits: {
      maxRequestsPerMinute: 3, // Lower to prevent abuse
      maxConcurrentRequests: 1,
      tokenBudgetPerHour: 10000,
    },
    privacy: {
      detectPII: true,
      redactPIIInLogs: true,
      redactPIIInOutput: true, // Refund data may contain sensitive info
    },
    audit: {
      logAllRequests: true,
      logInputPayload: true,  // Financial audit trail
      logOutputResult: true,
      logOnlyViolations: false,
    },
  };

  protected parseOutput(output: string): RefundResult {
    // ... parsing logic
  }
}
```

---

## 10. Environment Configuration

Add new safety-related env vars:

```bash
# .env.local

# ── Safety Constraints ─────────────────────────────────
AGENT_DEFAULT_TIMEOUT_MS=30000
AGENT_MAX_INPUT_CHARS=10000
AGENT_MAX_OUTPUT_CHARS=5000
AGENT_RATE_LIMIT_PER_MIN=10
AGENT_TOKEN_BUDGET_PER_HOUR=50000

# Circuit Breaker
AGENT_CIRCUIT_BREAKER_ENABLED=true
AGENT_CIRCUIT_BREAKER_THRESHOLD=5
AGENT_CIRCUIT_BREAKER_RESET_MS=60000

# Privacy
AGENT_PII_DETECTION_ENABLED=true
AGENT_PII_REDACTION_IN_LOGS=true
AGENT_LOG_RETENTION_DAYS=90

# Content Moderation
AGENT_CONTENT_MODERATION_ENABLED=true
```

Parse in `lib/agents/safety/config.ts`:

```typescript
import { z } from "zod";

const safetConfigSchema = z.object({
  AGENT_DEFAULT_TIMEOUT_MS: z.coerce.number().int().default(30000),
  AGENT_MAX_INPUT_CHARS: z.coerce.number().int().default(10000),
  AGENT_MAX_OUTPUT_CHARS: z.coerce.number().int().default(5000),
  AGENT_RATE_LIMIT_PER_MIN: z.coerce.number().int().default(10),
  AGENT_TOKEN_BUDGET_PER_HOUR: z.coerce.number().int().default(50000),
  AGENT_CIRCUIT_BREAKER_ENABLED: z.coerce.boolean().default(true),
  AGENT_CIRCUIT_BREAKER_THRESHOLD: z.coerce.number().int().default(5),
  AGENT_CIRCUIT_BREAKER_RESET_MS: z.coerce.number().int().default(60000),
  AGENT_PII_DETECTION_ENABLED: z.coerce.boolean().default(true),
  AGENT_PII_REDACTION_IN_LOGS: z.coerce.boolean().default(true),
  AGENT_LOG_RETENTION_DAYS: z.coerce.number().int().default(90),
  AGENT_CONTENT_MODERATION_ENABLED: z.coerce.boolean().default(true),
});

export const safetyConfig = safetConfigSchema.parse(process.env);
```

---

## 11. Database Schema Additions

### 11.1 New Enum for Safety Violations

```sql
create type safety_violation_enum as enum (
  'prompt_injection',
  'input_too_large',
  'output_too_large',
  'rate_limit',
  'timeout',
  'circuit_breaker',
  'pii_detected',
  'content_moderation',
  'token_budget',
  'malicious_pattern'
);
```

### 11.2 Enhanced `activity_logs` Metadata

Existing `metadata` JSONB column will store:

```json
{
  "safety": {
    "violations": ["pii_detected", "rate_limit"],
    "layer": "INPUT_SANITIZATION",
    "pii_types": ["email", "phone"],
    "circuit_state": "CLOSED",
    "tokens_used": 1234,
    "tokens_remaining": 48766
  }
}
```

---

## 12. Directory Structure (Target)

```
lib/agents/
├── base-agent.ts                    # Enhanced BaseAgent with safety layers
├── types.ts
├── prompts.ts
├── safety/
│   ├── types.ts                     # AgentSafetyPolicy, ValidationResult, etc.
│   ├── config.ts                    # Env parsing for safety settings
│   ├── default-policy.ts            # DEFAULT_SAFETY_POLICY constant
│   ├── guard.ts                     # SafetyGuard class
│   ├── circuit-breaker.ts           # CircuitBreaker class
│   ├── rate-limiter.ts              # AgentRateLimiter class
│   ├── logger.ts                    # SafetyLogger class
│   └── pii-detector.ts              # Standalone PII detection utilities
├── support/
├── recommendation/
├── sentiment/
└── refund/
```

---

## 13. Testing Strategy

### 13.1 Unit Tests

| Test Case | Assertion |
|-----------|-----------|
| Input exceeds `maxChars` | Returns `ValidationResult { valid: false }` |
| Prompt injection pattern detected | Returns `SanitizationResult { safe: false }` |
| Rate limit exhausted | Returns `RateLimitCheckResult { allowed: false }` |
| Timeout triggered | Returns `AgentResult { success: false, result: { error: "Request timed out." } }` |
| Circuit breaker open | Returns early without calling LLM |
| PII detected | Input is redacted before logging |
| Output exceeds `maxChars` | Returns validation failure |
| HTML in output when `allowHtml: false` | Returns validation failure |

### 13.2 Integration Tests

| Scenario | Expected Behavior |
|----------|-------------------|
| User submits 50 requests in 1 minute | 11th+ requests return rate limit error |
| Agent throws 5 consecutive errors | Circuit breaker opens; 6th request fails immediately |
| Input contains "ignore previous instructions" | Request rejected at sanitization layer |
| Output contains email address | Email is redacted in `activity_logs` |

### 13.3 Load Tests

- Simulate 1000 concurrent requests to validate rate limiter doesn't deadlock.
- Measure latency overhead of safety checks (<10ms additional latency).

---

## 14. Monitoring & Alerts

### 14.1 Metrics to Track

| Metric | Trigger Alert If... |
|--------|---------------------|
| `agent.safety.violations_total` (by layer) | Spike >50/min |
| `agent.circuit_breaker.open_count` | >3 agents open simultaneously |
| `agent.rate_limit.rejections_total` | >100/min (DDoS indicator) |
| `agent.pii.detections_total` | >10/hour (data leak risk) |
| `agent.latency.p99_ms` | >45000ms (approaching timeout) |

### 14.2 Dashboards

- **Safety Overview**: Pie chart of violations by type
- **Rate Limit Health**: Requests allowed vs. rejected per minute
- **Circuit Breaker Status**: State timeline for each agent
- **PII Leakage**: Count of redacted fields by type

---

## 15. Rollout Plan

| Phase | Scope | Acceptance Criteria |
|-------|-------|---------------------|
| **Phase 1** | Implement `SafetyGuard`, `CircuitBreaker`, `RateLimiter` | All unit tests pass |
| **Phase 2** | Integrate into `BaseAgent.run()` | Existing agents work with default policy |
| **Phase 3** | Add PII detection & redaction | No PII appears in dev logs |
| **Phase 4** | Deploy to staging with synthetic load | <5% false positive rate on prompt injection |
| **Phase 5** | Production rollout (canary 10% traffic) | No degradation in success rate |
| **Phase 6** | Enable content moderation | Harmful output blocked in 100% of test cases |

---

## 16. Future Enhancements

1. **Adaptive Rate Limiting** — Increase quotas for verified users or paid tiers.
2. **External Moderation API** — Integrate OpenAI Moderation API or Perspective API for robust content filtering.
3. **Streaming with Safety** — Apply safety checks incrementally on streamed tokens.
4. **Guardrails DSL** — Allow admins to define custom rejection patterns via UI without code changes.
5. **Distributed Circuit Breaker** — Share circuit state across Next.js instances via Redis.
6. **Automated Adversarial Testing** — Run red-team prompts nightly to detect new bypass techniques.

---

## 17. References

- [OWASP LLM Top 10](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)
- [Azure AI Content Safety Best Practices](https://learn.microsoft.com/en-us/azure/ai-services/content-safety/)
- [Anthropic: Prompt Injection Taxonomy](https://www.anthropic.com/research/prompt-injection)

---

## 18. Glossary

| Term | Definition |
|------|-----------|
| **Circuit Breaker** | Pattern that prevents cascading failures by short-circuiting requests after repeated errors. |
| **PII** | Personally Identifiable Information (e.g., email, SSN, phone, credit card). |
| **Prompt Injection** | Attack where user input manipulates the LLM to ignore system instructions. |
| **Rate Limiting** | Restriction on the number of requests a user/session can make per time window. |
| **Token Budget** | Maximum cumulative tokens (input + output) allowed per time window to control costs. |
| **Sanitization** | Process of removing or escaping dangerous content from user input. |
| **Content Moderation** | Automated filtering of harmful, hateful, or illegal content. |

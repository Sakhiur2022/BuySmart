# AI-24-02: Refund Decision Service Adapter

**Document Version:** 1.0  
**Status:** Implemented  
**Sprint:** Sprint-4  
**Last Updated:** April 2026

---

## Overview

AI-24-02 introduces a dedicated adapter layer that translates refund domain context into an AI request, validates structured model output, and returns a typed recommendation object.

Implemented artifacts:

- `lib/agents/refund/refund-decision-agent.ts`
- `lib/services/refund-decision-adapter.service.ts`

---

## Design Pattern Flow

### Adapter Pattern

Flow:

1. Caller provides `RefundDecisionInput`
2. Adapter validates input
3. Adapter dispatches `refund-decision` task via orchestrator
4. Agent invokes model with prompt contract
5. Adapter validates output and returns typed result

Why used:

- Hides provider/model invocation details from refund service
- Exposes narrow domain interface (`getRefundRecommendation`)
- Enables isolated mocking in tests

### Command/Orchestrator Integration

Current implementation uses orchestrator dispatch as the codebase-standard execution gateway.

- Task name: `refund-decision`
- Agent registration occurs in adapter constructor when missing

---

## SOLID Mapping

| Principle             | Application in AI-24-02                                                                 |
| --------------------- | --------------------------------------------------------------------------------------- |
| Single Responsibility | Adapter handles invocation, validation, and error normalization only                    |
| Open/Closed           | New providers can be added under AI service layer without changing caller contract      |
| Liskov Substitution   | Any implementation of `IRefundDecisionAdapter` can be injected in tests                 |
| Interface Segregation | Callers receive only typed recommendation output, not raw model payloads                |
| Dependency Inversion  | Adapter depends on orchestrator/agent abstraction and AI error categorization utilities |

---

## Interface Contract

File: `lib/services/refund-decision-adapter.service.ts`

Primary interface:

- `IRefundDecisionAdapter.getRefundRecommendation(input, context?)`

Return:

- `RefundDecisionOutput` validated by shared schema

---

## Error Strategy

Typed adapter errors:

- `REFUND_AI_INPUT_INVALID`
- `REFUND_AI_OUTPUT_INVALID`
- `REFUND_AI_TIMEOUT`
- `REFUND_AI_RATE_LIMIT`
- `REFUND_AI_CONFIGURATION`
- `REFUND_AI_REQUEST`
- `REFUND_AI_PROVIDER`

Mapping source:

- Existing AI error categorization from `lib/services/ai/error-handler.ts`

---

## Fallback Behavior

Service integration uses model-first execution with deterministic heuristic fallback in refund service.

- Adapter returns typed result on success
- Refund service falls back to heuristic analyzer when adapter/provider fails
- Refund creation remains non-blocking for buyer flow continuity

---

## Testing Strategy

Unit coverage includes:

1. Successful adapter dispatch + output validation
2. Input schema rejection
3. Output schema rejection

Agent-level coverage includes:

1. Structured JSON parse path
2. Unparseable response fallback path

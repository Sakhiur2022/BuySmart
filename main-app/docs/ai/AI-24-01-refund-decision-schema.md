# AI-24-01: Refund Decision Schema and Prompt Contract

**Document Version:** 1.0  
**Status:** Implemented  
**Sprint:** Sprint-4  
**Last Updated:** April 2026

---

## Overview

AI-24-01 defines the canonical refund decision contract used by the refund AI pipeline.

This task introduces:

- A reusable input contract for refund/order context
- A structured output contract for recommendation, risk, confidence, reasoning, and signals
- A versioned prompt artifact for deterministic JSON output
- Shared Zod validation boundaries consumed by adapter and persistence layers

The contract is implemented as first-class agent artifacts in `lib/agents/refund`.

---

## Design Pattern Flow

### Schema/Contract Pattern

Flow:

1. Refund service assembles domain context into contract input
2. Agent executes with prompt contract constraints
3. Output is validated against contract schema
4. Downstream layers consume only validated contract

Why used:

- Prevents ad-hoc JSON parsing in services/routes
- Enables explicit versioning (`ai24.v1`) for forward compatibility
- Ensures persistence layer receives a stable and typed shape

---

## SOLID Mapping

| Principle             | Application in AI-24-01                                                                  |
| --------------------- | ---------------------------------------------------------------------------------------- |
| Single Responsibility | Contract files only define schemas/types/prompt constants; no invocation, no persistence |
| Open/Closed           | Version field allows additive schema evolution without rewriting adapter/persistence     |
| Liskov Substitution   | Any producer returning valid `RefundDecisionOutput` can substitute model source          |
| Interface Segregation | Input contract captures only necessary refund evaluation signals                         |
| Dependency Inversion  | Downstream layers depend on contract abstractions, not model provider details            |

---

## Input Contract

File: `lib/agents/refund/types.ts`

`RefundDecisionInput` fields:

- `refund`: refund id, order id, reason, amount, created timestamp, currency
- `order`: order status, payment status, order total, remaining refundable amount
- `buyerHistory` (optional): aggregate refund counts
- `sellerHistory` (optional): aggregate dispute/order counts

Validation guarantees:

- Positive refund amount
- ISO datetime values
- 3-letter currency
- Numeric non-negative order totals

---

## Structured Output Contract

File: `lib/agents/refund/types.ts`

`RefundDecisionOutput` fields:

- `schemaVersion`: `ai24.v1`
- `recommendation`: `auto_approve | manual_review | auto_reject`
- `riskScore`: number in `[0,1]`, persisted with 4-decimal precision
- `confidenceScore`: number in `[0,1]`, persisted with 4-decimal precision
- `reasoning`: bounded text for admin-facing explanation
- `signals`: bounded explainability list with optional weight and note
- `modelMetadata`: provider, model, fallback flag, generation timestamp

Score thresholds (semantic policy):

- `0.00 - 0.34`: low risk bias
- `0.35 - 0.64`: manual review zone
- `0.65 - 1.00`: elevated risk zone

---

## Prompt Contract

File: `lib/agents/refund/refund-decision-prompt.ts`

Prompt constraints:

1. JSON-only output
2. Fixed field names aligned to contract schema
3. Recommendation enum constraints
4. Risk and confidence bounds
5. Conservative behavior under weak evidence (prefer `manual_review`)

Prompt version marker:

- `REFUND_DECISION_PROMPT_VERSION = ai24.prompt.v1`

---

## Validation Lifecycle

Validation is applied in two places:

1. Input validation before model invocation
2. Output validation before adapter returns typed data

Failure behavior:

- Input contract failure -> typed adapter input error
- Output contract failure -> typed adapter output error

---

## Extension Strategy

Future signals can be added as optional contract fields and surfaced in prompt examples while preserving backward compatibility through `schemaVersion`.

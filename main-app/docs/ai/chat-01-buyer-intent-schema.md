# CHAT-01: Buyer Intent Schema and Tool Contracts

**Document Version:** 1.0  
**Status:** Implemented  
**Sprint:** Sprint-6  
**Last Updated:** May 2026

---

## Overview

CHAT-01 defines the buyer intent taxonomy, validation pipeline, tool contracts, and UI coordination hooks that enable US-104 buyer self-service actions in chat.

This task introduces:

- A discriminated buyer intent taxonomy for refund requests, product recommendations, and policy Q&A
- Zod schemas for each intent payload with partial payload support
- Tool contracts for refund submission, recommendations, and policy answers
- A validation pipeline with event emission and typed error results
- Hooks and toast coordination for UI and mascot signals

---

## Design Pattern Flow

### Schema/Contract Pattern

Flow:

1. LLM output is parsed into a raw intent payload
2. Intent discriminant selects a schema from the registry
3. Zod validates the payload and returns a typed intent
4. Adapter maps the intent to a tool input contract
5. Tool contracts validate inputs and outputs via decorator

Why used:

- Prevents ad-hoc JSON parsing in chat workflows
- Keeps downstream controller inputs stable and validated
- Enables additive intent evolution without breaking existing contracts

---

## Intent Taxonomy

### Discriminants

- REFUND_REQUEST
- PRODUCT_RECOMMENDATION
- POLICY_QA

### REFUND_REQUEST Payload

| Field             | Type     | Required | Notes                                        |
| ----------------- | -------- | -------- | -------------------------------------------- |
| orderSignal       | object   | No       | Order id, recent orders flag, or description |
| reason            | enum     | No       | damage, non_delivery, wrong_item, other      |
| reasonDescription | string   | No       | Free-form buyer detail                       |
| evidence          | enum     | No       | photo_attached, no_photo, unknown            |
| evidenceImages    | string[] | No       | URLs, max 10                                 |
| requestedAmount   | number   | No       | Required before submission                   |
| currency          | string   | No       | ISO 4217 code                                |
| items             | array    | No       | Product and order item signals               |
| buyerId           | string   | No       | Populated from auth context when signed in   |

### PRODUCT_RECOMMENDATION Payload

| Field      | Type     | Required | Notes                     |
| ---------- | -------- | -------- | ------------------------- |
| budget     | object   | No       | min, max, currency        |
| category   | string   | No       | Category or product class |
| occasion   | string   | No       | Occasion or use case      |
| recipient  | enum     | No       | self, gift, unknown       |
| attributes | string[] | No       | Preferences and traits    |

### POLICY_QA Payload

| Field      | Type   | Required | Notes                                       |
| ---------- | ------ | -------- | ------------------------------------------- |
| question   | string | Yes      | Normalized question text                    |
| domain     | enum   | Yes      | returns, shipping, payments, account, other |
| confidence | enum   | Yes      | certain or ambiguous                        |

---

## Zod Schema Design

### Refund Request Schema

- Order identifiers are optional but validated when present
- Reason and evidence values are constrained to fixed enums
- Evidence images enforce URL format and max length
- Amount and currency are optional until submission
- Items enforce UUIDs, positive quantities, and bounded amounts

### Product Recommendation Schema

- Budget min and max enforce non-negative values and ordering
- Category and occasion have bounded string lengths
- Attributes are limited to 20 values for model safety
- Empty payloads remain valid for vague intent flows

### Policy Q&A Schema

- Question text required with a 600 character limit
- Domain constrained to known policy areas
- Confidence allows ambiguous classification without failing validation

---

## Tool Contracts

| Tool                   | Purpose                  | Input Schema                  | Output Schema                  |
| ---------------------- | ------------------------ | ----------------------------- | ------------------------------ |
| refund_request         | Submit refund creation   | createRefundDTOSchema         | Refund summary payload         |
| product_recommendation | Generate product matches | recommendationToolInputSchema | recommendationToolOutputSchema |
| policy_qa              | Answer policy questions  | policyQaToolInputSchema       | policyQaToolOutputSchema       |

Notes:

- Refund contract aligns with POST /api/refunds
- Recommendation contract aligns with POST /api/recommendations
- Policy Q&A output aligns with support-style response shape

---

## Singleton Registry

A singleton schema registry maps intent discriminants to Zod schemas. This keeps schema selection centralized and prevents divergent validation rules across services.

---

## Pattern Responsibilities

- Factory: selects the tool contract by intent discriminant
- Builder: assembles tool contract definitions with required fields
- Singleton: provides the shared schema registry
- Adapter: maps intent payloads to controller-ready input DTOs
- Facade: provides a single entry point for intent resolution and tool preparation
- Decorator: validates tool inputs and outputs without mutating tool logic
- Strategy: resolves intent payloads from raw model output per intent type
- Observer: emits validation events for logging and mascot coordination

---

## Hooks

### useBuyerIntentValidation

Purpose: validate raw intent output before chat submission.

Inputs:

- Optional strategy registry
- Optional event emitter

Outputs:

- intentType or null
- intent payload or null
- errors by field
- loading state
- reset and validate functions

### useChatToolStatus

Purpose: track tool lifecycle stages for UI feedback.

Outputs:

- status value
- error message
- update, fail, reset functions

### useMascotTrigger

Purpose: map validation events to mascot state signals.

Outputs:

- mascotState
- setMascotState

---

## Toasts

- Intent Validation Error: shown for schema-level validation issues
- Tool Invocation Failure: shown on tool call failures with retry affordance
- Refund Submission Success: shown when refund submission returns a reference id
- Recommendation Load: shown only when recommendation latency exceeds threshold

---

## Validation Pipeline

Stages:

1. Raw output reception
2. Intent discriminant extraction
3. Schema selection
4. Payload validation
5. Strategy dispatch
6. Adapter translation
7. Event emission

Each stage returns typed error results instead of throwing.

---

## Error Taxonomy

- INVALID_JSON
- MISSING_INTENT
- UNKNOWN_INTENT
- SCHEMA_NOT_FOUND
- INVALID_PAYLOAD
- STRATEGY_NOT_FOUND
- ADAPTER_ERROR
- TOOL_NOT_FOUND

All errors are returned as typed results and can emit observer events.

---

## Extension Strategy

To add a new buyer intent:

1. Add a new discriminant and payload type
2. Create a Zod schema for the payload
3. Register the schema in the singleton registry
4. Add a tool contract and adapter mapping
5. Add strategy and tests

This keeps existing intent contracts closed to modification and open to extension.

# API-02 — Chatbot Buyer API Route

**Document Version:** 1.0  
**Status:** Draft  
**Sprint:** Sprint-6  
**Last Updated:** May 2026

---

## Overview

- Purpose: buyer chat API entrypoint for US-104 in-chat self-service actions.
- Scope: authenticated POST /api/buyer/chat with intent routing, tool invocation, and context updates.

---

## US-104 Scenario Mapping

- Scenario 1: buyer asks for product discovery or general help (intent detection → support/search reply).
- Scenario 2: refund request in chat (intentOutput validation → tool call → refund reference id in response).
- Scenario 3: recommendation request (intentOutput validation → recommendation tool → structured result).
- Scenario 4: unauthenticated access (401 with buyer-friendly error).

---

## Route Operations

### Request Validation

- Input source: buyer chat UI POST payload.
- Output: validated request body or 400 validation response.
- Dependencies: zod schema + recommendation candidate schema.

### Authentication Gate

- Input source: session cookies (Supabase SSR).
- Output: user identity or 401 response.
- Dependencies: shared auth helper.

### Intent Resolution + Tool Invocation

- Input source: intentOutput + recommendationContext (optional).
- Output: toolCall/toolResult or toolError in response payload.
- Dependencies: BuyerChatToolsFacade + invokeBuyerToolCall.

### Response Assembly

- Input source: detected intent + tool outputs + context history.
- Output: ChatAPIResponse with updatedContext and optional tool fields.
- Dependencies: support AI + mock search/order helpers (current branch).

---

## Route Contract Table

| Endpoint         | Purpose                                        | Input                                    | Output                         |
| ---------------- | ---------------------------------------------- | ---------------------------------------- | ------------------------------ |
| POST /api/buyer/chat | Single buyer chat entrypoint (auth + intent) | ChatAPIRequest (message, context, intentOutput) | ChatAPIResponse (reply + context + tool fields) |

---

## Error Taxonomy

- Validation errors: invalid JSON, schema violations (400 with issues).
- Auth errors: unauthenticated requests (401).
- Tool errors: surfaced via toolError in payload (200 with error details).
- Unknown errors: 500 with buyer-friendly fallback and requestId.

---

## Design Patterns

- Facade: BuyerChatToolsFacade coordinates intent resolution and tool selection.
- Adapter: recommendation context adapts to tool input shape.
- Decorator: tool validation and retry logic inside tool invocation.
- Strategy: intent normalization and tool routing strategies.
- Observer: intent validation event emitter for instrumentation.

---

## Hooks

- None (API route only; UI hooks remain unchanged).

---

## Toast Coordination

- No direct toasts in API route; UI uses response payload to drive toast state.
- Refund-specific toast behavior remains in the refund tool flow (see API-01).

---

## Retry Policy

- Route: no explicit retry at handler level.
- Tool layer: refund tool retries are handled by tool invocation utilities.

---

## CHAT-01 Integration

- Consumes validated intentOutput from CHAT-01 and passes through tool facade.
- Returns intentResolution/toolCall/toolResult without re-validating CHAT-01 outputs beyond tool contracts.

---

## Extension Strategy

- Add seller/admin chat routes as separate endpoints without altering buyer route.
- Introduce stricter role gating if policy changes (buyers-only gate).
- Expand tool catalog by registering new intents in the facade and tool factory.

---

## Test Plan Summary

- Integration tests: buyer chat route validation, unauthenticated access, refund tool, recommendation tool.
- Coverage includes: invalid JSON, auth failures, tool invocation success paths.

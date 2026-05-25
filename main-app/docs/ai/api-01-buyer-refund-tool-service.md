# API-01 — Buyer Refund Tool Service

**Document Version:** 1.0  
**Status:** Draft  
**Sprint:** Sprint-6  
**Last Updated:** May 2026

---

## Overview

- Purpose: buyer refund tool service for US-104 chat flow.
- Scope: orders fetch + refund submit only.

---

## US-104 Scenario Mapping

- Scenario 1: refund request in chat (orders fetch → order selection → refund submit).
- Scenario 2: refund API unavailable (error mapping → mascot fallback signal).

---

## Tool Operations

### Orders Fetch

- Input source: REFUND_REQUEST order signal.
- Output: order cards for chat rendering.
- Dependencies: order service + repository.

### Refund Submit

- Input source: validated refund request tool input.
- Output: refund confirmation with reference id.
- Dependencies: refund controller/service + repository.

---

## Tool Contract Table

| Tool Name           | Purpose                                        | Input                       | Output                      |
| ------------------- | ---------------------------------------------- | --------------------------- | --------------------------- |
| refund_orders_fetch | Fetch recent buyer orders for refund selection | REFUND_REQUEST order signal | Order card list             |
| refund_request      | Submit refund creation                         | createRefundDTOSchema       | Refund confirmation payload |

---

## Error Taxonomy

- Business errors: order not found, ineligible status, already refunded.
- Infrastructure errors: API unavailable, timeouts, DB errors.
- Validation errors: missing required fields, invalid evidence.
- Unknown errors: default fallback.

---

## Design Patterns

- Factory: tool instantiation.
- Builder: refund submit command assembly.
- Singleton: error code map.
- Adapter: order card + refund payload adapters.
- Facade: buyer refund tool entry point.
- Decorator: retry for transient errors.
- Strategy: order fetch selection.
- Observer: tool event emission.

---

## Hooks

- useRefundToolStatus
- useOrderCardSelection
- useRefundEvidenceAttachment
- useMascotRefundFallback

---

## Toast Coordination

- Orders fetch loading toast (delayed).
- Orders fetch error toast (retry).
- Refund submission loading toast.
- Refund confirmation toast.
- Refund API unavailable toast (mascot fallback).
- Refund business error toast.

---

## Retry Policy

- Retriable errors: infra/timeouts/DB.
- Budget: short backoff for prompt fallback.

---

## CHAT-01 Integration

- Uses validated intent payload and adapter output.
- No re-validation of fields already validated by CHAT-01.

---

## Extension Strategy

- Add seller/admin flows via new tools without modifying buyer tool core.

---

## Test Plan Summary

- Unit tests: adapters, strategies, builder, error map, retry decorator.
- Integration tests: tool invocation flow, refund submit success/error, mascot trigger.

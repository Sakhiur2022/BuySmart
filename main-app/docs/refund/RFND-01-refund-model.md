# RFND-01: Refund Model and DTO Contracts

**Document Version:** 1.0  
**Status:** Implemented (Contracts)  
**Sprint:** Sprint-4  
**Last Updated:** April 2026

---

## Overview

RFND-01 implements the refund contract foundation for the service and API layers using TypeScript domain contracts and Zod validation schemas.

This branch introduces:

- A pure refund domain model and immutable RefundItem value object
- Refund lifecycle and reason contracts aligned with database enum literals
- DTO contracts for create, update, summary, response, detail, and filtering
- Co-located Zod schemas for inbound validation and query filtering
- Interface-only repository and service contracts (no concrete implementation yet)

The implementation is intentionally contract-first to allow parallel work on API routes, service logic, and repository persistence without type drift.

---

## Branch Diff Summary

Compared against `main`, the current branch introduces exactly four new files:

```bash
git diff --name-status main...HEAD

A       main-app/lib/models/refund.model.ts
A       main-app/lib/repositories/refund.repository.ts
A       main-app/lib/services/refund.service.ts
A       main-app/lib/types/refund.types.ts
```

Diff stats:

```bash
git diff --stat main...HEAD

main-app/lib/models/refund.model.ts            | 112 +++++++++++
main-app/lib/repositories/refund.repository.ts |  21 ++
main-app/lib/services/refund.service.ts        |  31 +++
main-app/lib/types/refund.types.ts             | 258 +++++++++++++++++++++++++
4 files changed, 422 insertions(+)
```

---

## User Stories Covered

| Story ID | Title                                                            | Status      |
| -------- | ---------------------------------------------------------------- | ----------- |
| US-RFND  | Platform has a shared refund domain model contract               | Implemented |
| US-RFND  | API and service layers share validated refund create/update DTOs | Implemented |
| US-RFND  | Refund listing supports typed filter and pagination contracts    | Implemented |
| US-RFND  | Repository and service boundaries are interface-driven           | Implemented |
| US-RFND  | Refund status transitions are constrained by typed schema        | Implemented |

---

## Database Contract Alignment

RFND-01 does not add or alter SQL schema in this branch. Instead, it aligns contracts to existing generated Supabase types in `lib/types/database.types.ts`.

### Enums Mapped

- `refund_status_enum`
- `refund_reason_enum`
- `refund_type_enum`
- `ai_refund_decision_enum`

### Refund Table Fields Referenced

The new model and DTO contracts align with existing `refunds` table columns such as:

- `refund_id`, `refund_number`, `order_id`, `order_item_id`, `user_id`
- `status`, `refund_type`, `reason_code`, `reason_description`
- `requested_amount`, `refund_amount`
- `processed_by`, `processed_at`, `processing_notes`, `refunded_at`
- `return_required`, `return_tracking`, `return_received_at`
- `ai_recommendation`, `ai_risk_score`, `ai_processed_at`, `ai_analysis`
- `evidence_images`, `created_at`, `updated_at`

---

## TypeScript Models and DTOs

### Refund Domain Model

**File:** `lib/models/refund.model.ts`

Key exports:

- `RefundStatus`, `RefundReason`, `RefundType`, `RefundAIDecision`
- `MoneyAmount` value contract
- `RefundItem` immutable value object
- `Refund` aggregate domain contract

#### RefundItem Value Object Behavior

`RefundItem` is designed as a value object with:

1. Constructor-level structural validation
2. Amount normalization to two decimal places
3. Readonly fields and `Object.freeze(this)` immutability
4. `equals(...)` for value equality checks
5. `toJSON()` for serialization-safe snapshots

### Refund DTO and Validation Layer

**File:** `lib/types/refund.types.ts`

DTO exports:

- `CreateRefundDTO`
- `UpdateRefundDTO`
- `RefundResponseDTO`
- `RefundSummaryDTO`
- `RefundDetailDTO`
- `RefundFilterDTO`
- `RefundStatusTransitionDTO`
- `RefundListResponseDTO`

Schema exports:

- `createRefundDTOSchema`
- `updateRefundDTOSchema`
- `refundFilterDTOSchema`
- `refundStatusTransitionSchema`

Additional constants:

- `DEFAULT_REFUND_PAGE_SIZE`, `MAX_REFUND_PAGE_SIZE`
- `REFUND_STATUS_VALUES`, `REFUND_REASON_VALUES`, `REFUND_TYPE_VALUES`
- `AI_REFUND_DECISION_VALUES`, `REFUND_SORT_VALUES`

---

## Validation and Transition Rules

### CreateRefundDTO Rules

- `order_id` is required UUID
- `refund_type` and `reason_code` are enum constrained
- `requested_amount` is bounded numeric input
- `single_item` requires `order_item_id`
- `partial_order` and `single_item` require at least one `items` entry

### UpdateRefundDTO Rules

- Supports partial updates for amounts, tracking, processing, and AI metadata
- Enforces mutually exclusive `status` vs `status_transition`

### Status Transition Schema

`refundStatusTransitionSchema` uses a discriminated union on `to` to enforce transition-specific payload requirements:

- `approved`
- `rejected` (requires notes)
- `processing`
- `completed` (requires `refunded_at`)
- `cancelled`

---

## Architecture and Layer Responsibilities

### Layer Diagram

```text
Contracts Consumer (API Route / Controller / Service Impl)
										|
										v
					DTO + Zod Contracts Layer
					lib/types/refund.types.ts
										|
										v
						 Domain Model Layer
					lib/models/refund.model.ts
										|
										v
				Repository and Service Interfaces
	lib/repositories/refund.repository.ts
			lib/services/refund.service.ts
```

### Responsibility Split

- `refund.model.ts`: domain contracts and value object semantics
- `refund.types.ts`: API/service boundary DTOs and input validation schemas
- `refund.repository.ts`: persistence contract interface only
- `refund.service.ts`: business operation contract interface only

---

## File Structure Map

### New Files Created

```text
lib/models/
	refund.model.ts
		- RefundStatus / RefundReason / RefundType / RefundAIDecision
		- MoneyAmount
		- RefundItem (immutable value object)
		- Refund

lib/types/
	refund.types.ts
		- CreateRefundDTO / UpdateRefundDTO
		- RefundSummaryDTO / RefundResponseDTO / RefundDetailDTO
		- RefundFilterDTO / RefundStatusTransitionDTO
		- createRefundDTOSchema / updateRefundDTOSchema / refundFilterDTOSchema

lib/repositories/
	refund.repository.ts
		- IRefundReadRepository
		- IRefundWriteRepository
		- IRefundRepository

lib/services/
	refund.service.ts
		- IRefundReadService
		- IRefundWriteService
		- IRefundService
```

### Modified Files

None in this branch diff versus `main`. All refund work is additive.

---

## Repository Contract Summary

**File:** `lib/repositories/refund.repository.ts`

Read contract:

- `findById(refundId)`
- `list(filters)`
- `listByOrderId(orderId)`
- `existsActiveRefundForOrderItem(orderItemId)`

Write contract:

- `create(input)`
- `update(refundId, input)`

The repository contract returns domain-level refund models and avoids exposing raw database client types in method signatures.

---

## Service Contract Summary

**File:** `lib/services/refund.service.ts`

Read service contract:

- `getRefundById(userId, refundId)`
- `getRefundDetail(userId, refundId)`
- `listRefunds(userId, filters)`

Write service contract:

- `createRefund(userId, input)`
- `updateRefund(userId, refundId, input)`
- `transitionRefundStatus(userId, refundId, transition)`

Service interfaces consume and return DTOs only, preserving separation from transport and persistence concerns.

---

## Scope and Non-Goals

### Implemented in RFND-01

1. Domain model contracts
2. DTO contracts
3. Zod input/filter schemas
4. Status transition validation contract
5. Repository/service interfaces

### Not Implemented in RFND-01

1. Concrete repository implementation
2. Concrete service implementation
3. Refund API route handlers
4. Controller wiring for refunds
5. Unit/integration test suites for refund flows

---

## Validation and Quality Notes

- New files are lint-clean and type-clean under scoped checks.
- Full-project lint issues observed in this branch are pre-existing and unrelated to RFND-01 changes.
- Contract-first delivery enables safe incremental implementation in later refund stories.

---

## Next Story Dependencies

RFND-01 unblocks:

1. RFND-02 repository implementation against Supabase
2. RFND-03 service business rules (authorization, eligibility, transitions)
3. RFND-04 API routes for create/update/list/detail
4. RFND-05 integration and unit tests for refund contract and flow coverage

---

## Summary

RFND-01 delivers a complete refund contract baseline on the current branch with strict type boundaries and validation schemas.

The branch diff against `main` is focused and additive, introducing four new files that establish:

- refund domain model semantics,
- shared DTO contracts,
- transition-aware validation,
- and interface-driven repository/service boundaries.

This creates a stable foundation for subsequent implementation stories while preserving layered architecture consistency across the codebase.

---

**Document Maintainers:** Development Team  
**Last Reviewed:** April 2026  
**Next Review:** Upon completion of repository/service concrete implementations and refund API routes

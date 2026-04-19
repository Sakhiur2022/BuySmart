# RFND-03: Refund Creation Service (Eligibility Validation)

**Document Version:** 1.0  
**Status:** Implemented  
**Sprint:** Sprint-4  
**Last Updated:** April 2026

---

## Overview

RFND-03 implements the refund creation service layer with strict eligibility validation before any refund record is created.

The implementation delivers:

- **Fail-fast validation** before persistence in refund create flow
- **Order status eligibility rule** allowing refunds only for delivered/completed orders
- **Amount eligibility rule** requiring positive requested amount within remaining refundable balance
- **Partial-refund-aware balance calculation** using previously processed refunds
- **Typed validation errors** for ineligible status and invalid amount
- **Layered architecture compliance**: API route -> controller -> service -> repository -> Supabase
- **Unit and integration test coverage** for acceptance and rejection paths

The implementation is intentionally backend-focused and does not include UI behavior.

---

## User Stories Covered

| Story ID | Title                                                                      | Status         |
| -------- | -------------------------------------------------------------------------- | -------------- |
| US-RFND  | Buyer can request refund only when order is delivered/completed            | ✅ Implemented |
| US-RFND  | Buyer cannot request zero/negative refund amount                           | ✅ Implemented |
| US-RFND  | Buyer cannot exceed remaining refundable balance after prior partials      | ✅ Implemented |
| US-RFND  | API returns explicit reason for ineligible status validation failure       | ✅ Implemented |
| US-RFND  | API returns explicit reason for invalid amount validation failure          | ✅ Implemented |
| US-RFND  | Create path blocks persistence when eligibility fails (fail-fast behavior) | ✅ Implemented |

---

## Branch Diff (Current Branch vs main)

Branch:

```bash
feature/refund-service-create
```

Name-status diff:

```bash
git diff --name-status main...HEAD

A       main-app/app/api/refunds/[id]/route.ts
A       main-app/app/api/refunds/route.ts
A       main-app/lib/controllers/refund.controller.ts
M       main-app/lib/repositories/refund.repository.ts
M       main-app/lib/repositories/refundRepository.ts
M       main-app/lib/services/refund.service.ts
A       main-app/tests/integration/api/refunds.route.test.ts
A       main-app/tests/unit/services/refund.service.test.ts
```

Stat diff:

```bash
git diff --stat main...HEAD

main-app/app/api/refunds/[id]/route.ts             |  58 ++++++
main-app/app/api/refunds/route.ts                  | 140 +++++++++++++
main-app/lib/controllers/refund.controller.ts      |  30 +++
main-app/lib/repositories/refund.repository.ts     |  17 ++
main-app/lib/repositories/refundRepository.ts      |  63 ++++++
main-app/lib/services/refund.service.ts            | 201 +++++++++++++++++++
.../tests/integration/api/refunds.route.test.ts    | 221 +++++++++++++++++++++
.../tests/unit/services/refund.service.test.ts     | 134 +++++++++++++
8 files changed, 864 insertions(+)
```

---

## Architecture & Data Flow

### Layer Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  HTTP Request                                               │
│  (/api/refunds, /api/refunds/[id])                         │
└─────────────────────────────────┬───────────────────────────┘
																	│
								┌─────────────────▼──────────────────┐
								│  API Layer                          │
								│  - requireAuthenticatedUser         │
								│  - zod validation                   │
								│  - error-to-HTTP mapping            │
								└─────────────────┬──────────────────┘
																	│
								┌─────────────────▼──────────────────┐
								│  Controller Layer                  │
								│  lib/controllers/refund.controller.ts
								│  - createRefund                     │
								│  - listRefunds                      │
								│  - getRefundById                    │
								└─────────────────┬──────────────────┘
																	│
								┌─────────────────▼──────────────────┐
								│  Service Layer                     │
								│  lib/services/refund.service.ts    │
								│  - createRefund eligibility checks │
								│  - ownership and list scoping      │
								└─────────────────┬──────────────────┘
																	│
								┌─────────────────▼──────────────────┐
								│  Repository Layer                  │
								│  lib/repositories/refundRepository.ts
								│  - getEligibilitySnapshot          │
								│  - create/list/detail queries      │
								└─────────────────┬──────────────────┘
																	│
								┌─────────────────▼──────────────────┐
								│  Supabase PostgreSQL               │
								│  orders + refunds + order_items    │
								└────────────────────────────────────┘
```

### Why Layered?

- Keeps route handlers thin and focused on auth/validation/transport
- Centralizes business rules in service layer
- Keeps DB access and query composition inside repository
- Preserves testability by mocking boundaries per layer

---

## File Structure Map

### New Files Created

```
app/api/refunds/
	├─ route.ts
	│   ├─ GET /api/refunds
	│   └─ POST /api/refunds
	└─ [id]/route.ts
			└─ GET /api/refunds/[id]

lib/controllers/
	└─ refund.controller.ts
			├─ createRefund
			├─ getRefundById
			└─ listRefunds

tests/integration/api/
	└─ refunds.route.test.ts

tests/unit/services/
	└─ refund.service.test.ts
```

### Modified Files

| File                                    | Changes                                                                  | Reason                                        |
| --------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------- |
| `lib/services/refund.service.ts`        | Added concrete service implementation + eligibility validation           | Implement RFND-03 business logic              |
| `lib/repositories/refund.repository.ts` | Added `RefundEligibilitySnapshotDTO` + `getEligibilitySnapshot` contract | Support validation snapshot input             |
| `lib/repositories/refundRepository.ts`  | Added eligibility snapshot query + prior refund aggregation logic        | Compute remaining refundable amount correctly |

---

## Eligibility Validation Rules

### Rule 1: Order Status Eligibility

Order must be in one of the allowed statuses:

- `delivered`
- `completed`

Any other order status throws `RefundIneligibleStatusError` with code `REFUND_INELIGIBLE_STATUS`.

### Rule 2: Requested Amount Basic Validity

Requested refund amount must be:

- a finite numeric value
- strictly greater than zero

Invalid values throw `RefundInvalidAmountError` with code `REFUND_INVALID_AMOUNT`.

### Rule 3: Requested Amount vs Remaining Refundable Balance

Requested amount must not exceed computed remaining refundable balance:

$$
	ext{remaining\_refundable\_amount} = \max(\text{order\_total\_amount} - \text{processed\_refund\_total}, 0)
$$

If requested amount exceeds remaining balance, `RefundInvalidAmountError` is thrown.

### Rule 4: Fail Fast Before Write

`createRefund(...)` validates status and amount before calling repository `create(...)`. If validation fails, no refund row is written.

---

## Repository Query Strategy

**File:** `lib/repositories/refundRepository.ts`

Eligibility snapshot flow:

1. Read order by `order_id` and `buyer_id`
2. If not found, return `null` (service maps this to `Order not found`)
3. Query existing refunds for the same order
4. Sum only statuses included in accumulation set:
   - `approved`
   - `processing`
   - `completed`
5. Return typed snapshot for service validation:
   - `order_id`
   - `buyer_id`
   - `order_status`
   - `order_total_amount`
   - `processed_refund_total`
   - `remaining_refundable_amount`
   - `currency`

This ensures partial refunds are respected when calculating available balance.

---

## Route and Error Mapping

### API Routes

| Route               | Method | Description                               |
| ------------------- | ------ | ----------------------------------------- |
| `/api/refunds`      | GET    | List refunds with filter and pagination   |
| `/api/refunds`      | POST   | Create refund with eligibility validation |
| `/api/refunds/[id]` | GET    | Fetch refund detail for authorized user   |

### Error Mapping

`app/api/refunds/route.ts` maps service/repository errors to HTTP responses:

- `REFUND_INELIGIBLE_STATUS` -> `422`
- `REFUND_INVALID_AMOUNT` -> `400`
- `UNAUTHENTICATED` -> `401`
- `FORBIDDEN` -> `403`
- `Order not found` / `Refund not found` -> `404`
- Duplicate key conflict -> `409`
- Validation failures -> `400`
- Unknown error -> `500`

`app/api/refunds/[id]/route.ts` includes id param validation and ownership-aware `401/403/404/400/500` mapping.

---

## Testing Checklist

### Unit Tests (`tests/unit/services/refund.service.test.ts`)

1. Reject create when order status is ineligible (`processing`)
2. Reject create when requested amount is zero
3. Reject create when requested amount exceeds remaining refundable balance
4. Allow create when status and amount are eligible
5. Verify repository `create` is not called on failed eligibility

### Integration Tests (`tests/integration/api/refunds.route.test.ts`)

1. `POST /api/refunds` returns `201` on success
2. `POST /api/refunds` returns `400` for invalid JSON payload
3. `POST /api/refunds` returns `400` for schema validation failure
4. `POST /api/refunds` returns `422` with `REFUND_INELIGIBLE_STATUS`
5. `POST /api/refunds` returns `400` with `REFUND_INVALID_AMOUNT`
6. `POST /api/refunds` returns `401` when unauthenticated
7. `GET /api/refunds` returns `200` with list response for valid filters

Execution status on branch:

- Targeted tests executed successfully (`11 passed`).

---

## Future Considerations

### Not Yet Implemented

1. Dedicated typed HTTP mapping for repository conflict/constraint classes in all refund routes
2. Expanded integration tests for `GET /api/refunds/[id]` paths
3. Multi-currency precision policy hardening if mixed-currency orders are introduced
4. End-to-end create flow tests including live repository snapshot aggregation with seeded partial refunds
5. Separation of validation-only service from creation orchestration service if flow complexity grows

---

## Summary

RFND-03 delivers the refund creation eligibility layer with concrete service and repository integration.

Implemented scope includes:

- Service-level fail-fast validation for status and amount
- Partial-refund-aware remaining balance calculation
- New refund API routes wired through controller/service/repository boundaries
- Typed error codes for ineligible status and invalid amount
- Unit and integration tests covering core acceptance/rejection scenarios

This establishes a reliable backend validation guardrail before refund persistence and aligns with existing BuySmart layered architecture patterns.

---

**Document Maintainers:** Development Team  
**Last Reviewed:** April 2026  
**Next Review:** (Upon refund status transition and settlement flow enhancements)

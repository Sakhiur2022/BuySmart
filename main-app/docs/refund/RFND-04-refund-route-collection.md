# RFND-04: Refund Route Collection Access and Error-Mapping Hardening

**Document Version:** 1.0  
**Status:** Implemented on current branch (vs `main`)  
**Sprint:** Sprint-4  
**Last Updated:** April 2026

---

## Overview

RFND-04 closes the remaining collection-route and access-control gaps in the refund module using a layered route -> controller -> service -> repository flow.

Implemented scope includes:

- **Role-aware collection access** for `GET /api/refunds`
  - `buyer` sees own refunds
  - `seller` sees refunds tied to seller-owned order items
  - unsupported roles (`admin`, `moderator`, unknown) are rejected with `FORBIDDEN`
- **Buyer-only creation guard** for `POST /api/refunds`
- **Centralized refund route error mapper** reused by both collection and item routes
- **Public vs internal filter contract split** so ownership scope is service-enforced, not caller-provided
- **Expanded unit + integration tests** covering the new branch behavior

The implementation preserves existing architecture patterns and avoids route-level role logic beyond authenticated identity extraction.

---

## Branch Diff Scope (Current Branch vs `main`)

### Added Files

- `app/api/refunds/_shared.ts`
- `tests/unit/controllers/refund.controller.test.ts`
- `tests/unit/repositories/refund.repository.test.ts`

### Modified Files

- `app/api/refunds/route.ts`
- `app/api/refunds/[id]/route.ts`
- `lib/services/refund.service.ts`
- `lib/repositories/refund.repository.ts`
- `lib/repositories/refundRepository.ts`
- `lib/types/refund.types.ts`
- `tests/unit/services/refund.service.test.ts`
- `tests/integration/api/refunds.route.test.ts`

---

## User Stories Covered

| Story ID | Title                                                          | Status      |
| -------- | -------------------------------------------------------------- | ----------- |
| US-XX    | Buyer can list only own refunds                                | Implemented |
| US-XX    | Seller can list refunds scoped to seller-owned orders          | Implemented |
| US-XX    | Non-buyer users cannot submit refund requests                  | Implemented |
| US-XX    | Refund routes return consistent, typed error responses         | Implemented |
| US-XX    | Refund route behavior is covered by unit and integration tests | Implemented |

---

## Architecture and Data Flow

### Layer Diagram

```
GET/POST /api/refunds
				 |
				 v
Route Layer (auth + zod parse + response mapping)
				 |
				 v
Controller Layer (delegation only)
				 |
				 v
Service Layer (role resolution + scope enforcement + business rules)
				 |
				 v
Repository Layer (role lookup + scoped DB list/query)
				 |
				 v
Supabase/PostgreSQL
```

### Why This Approach

- Route remains thin and stable (only auth identity + DTO validation).
- Role logic is centralized in service for testability and maintainability.
- Repository remains data-access-focused and exposes role lookup abstraction.
- Shared route error mapper prevents divergent error behavior between routes.

---

## File Structure Map

### New Files Created

```
app/api/refunds/
	_shared.ts
		- formatRefundErrorResponse
		- logRefundRouteError

tests/unit/controllers/
	refund.controller.test.ts
		- create/list/get delegation contract tests

tests/unit/repositories/
	refund.repository.test.ts
		- role lookup test
		- seller-scope list test
		- empty-seller-scope pagination test
```

### Modified Files and Purpose

| File                                          | Change                                                                                                     | Why                                                |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `app/api/refunds/route.ts`                    | Replaced inline error helpers with shared imports; removed external `buyer_id`/`seller_id` query ingestion | Keep route thin and prevent caller scope injection |
| `app/api/refunds/[id]/route.ts`               | Reused shared error mapping and added route-level error logging                                            | Consistent error semantics across refund routes    |
| `lib/services/refund.service.ts`              | Added actor role resolution and scoped list/create enforcement                                             | Implement RFND-04 role-aware behavior              |
| `lib/repositories/refund.repository.ts`       | Extended interface with `getUserRole` and internal list filter type                                        | Support DIP + service-driven scoping               |
| `lib/repositories/refundRepository.ts`        | Implemented role lookup against `users_profile`; updated list signatures                                   | Concrete repository support for role-aware service |
| `lib/types/refund.types.ts`                   | Added `RefundRepositoryFilterDTO`                                                                          | Split public request DTO from internal scoped DTO  |
| `tests/unit/services/refund.service.test.ts`  | Added role-aware list/create cases                                                                         | Validate service orchestration rules               |
| `tests/integration/api/refunds.route.test.ts` | Added GET seller scope and POST forbidden/conflict/not-found cases                                         | Validate route outcomes and error status mapping   |

---

## Type/Interface Contract Updates

### Public Request DTO (Route Boundary)

- `RefundFilterDTO` continues to represent request-side GET filters.
- Route no longer maps external `buyer_id` and `seller_id` query params into the validated DTO input.

### Internal Service -> Repository DTO

- New type: `RefundRepositoryFilterDTO = RefundFilterDTO & { buyer_id?: string; seller_id?: string }`
- Service enriches the DTO with authoritative scope based on authenticated user role.

### Repository Abstraction

`IRefundReadRepository` now includes:

- `getUserRole(userId: string): Promise<UserRole | null>`
- `list(filters: RefundRepositoryFilterDTO): Promise<RefundListResponseDTO>`

---

## Endpoint Behavior

### GET /api/refunds

Flow:

1. Route authenticates user (`requireAuthenticatedUser`) and validates query DTO.
2. Controller delegates to service.
3. Service resolves actor role via repository.
4. Service applies scope:
   - buyer -> `buyer_id = userId`, `seller_id = undefined`
   - seller -> `seller_id = userId`, `buyer_id = undefined`
   - otherwise -> throw `FORBIDDEN`
5. Repository executes scoped query and returns paginated response.

### POST /api/refunds

Flow:

1. Route authenticates user and validates request body.
2. Controller delegates to service.
3. Service resolves actor role.
4. If actor role is not `buyer`, service throws `FORBIDDEN` before eligibility lookup.
5. Existing eligibility/status/payment/amount validations run for buyer path.

---

## Shared Error Mapping

### Shared Helper Location

- `app/api/refunds/_shared.ts`

### Mapped Outcomes

| Condition                                         | Status | Body                                       |
| ------------------------------------------------- | ------ | ------------------------------------------ |
| `UNAUTHENTICATED`                                 | 401    | Unauthorized message                       |
| `FORBIDDEN`                                       | 403    | Insufficient permissions message           |
| `Order not found` / `Refund not found`            | 404    | Not found message                          |
| `RefundIneligibleStatusError`                     | 422    | error + `REFUND_INELIGIBLE_STATUS`         |
| `RefundIneligiblePaymentStatusError`              | 422    | error + `REFUND_INELIGIBLE_PAYMENT_STATUS` |
| `RefundInvalidAmountError`                        | 400    | error + `REFUND_INVALID_AMOUNT`            |
| `RefundConflictError`                             | 409    | error + `REFUND_CONFLICT`                  |
| `RefundForeignKeyError` / `RefundConstraintError` | 400    | error + repository code                    |
| `RefundRepositoryError`                           | 500    | safe repository failure response           |
| Unknown                                           | 500    | Internal server error fallback             |

### Logging

- `logRefundRouteError(context, error)` logs structured metadata (`name`, `code`, `message`, optional details/hint, stack) from both collection and item routes.

---

## Repository Query Strategy

### Role Lookup

`getUserRole` query:

- table: `users_profile`
- select: `role`
- predicate: `eq('user_id', userId)`
- behavior: returns `role | null`, mapped via repository error handling

### Seller Scope in List

Seller scoping behavior remains repository-based:

1. Resolve order IDs from `order_items` by `seller_id`
2. If no order IDs exist, return empty paginated envelope
3. Otherwise apply `in('order_id', scopedOrderIds)` on refunds query

---

## Testing Coverage Added

### Unit: Controller

File: `tests/unit/controllers/refund.controller.test.ts`

- create/list/get delegate to service with unchanged args
- controller preserves service rejection propagation

### Unit: Service

File: `tests/unit/services/refund.service.test.ts`

- list buyer role injects buyer scope
- list seller role injects seller scope
- list unsupported role rejects with `FORBIDDEN`
- create non-buyer role rejects with `FORBIDDEN` before eligibility lookup
- existing eligibility/amount behavior retained under buyer role

### Unit: Repository

File: `tests/unit/repositories/refund.repository.test.ts`

- role lookup reads `users_profile.role`
- seller scope applies order-id filtering path
- no matching seller orders returns empty page envelope

### Integration: Route

File: `tests/integration/api/refunds.route.test.ts`

- GET seller request returns 200 and delegates parsed filters
- GET unauthenticated request returns 401
- GET invalid query returns 400 validation envelope
- POST non-buyer request returns 403
- POST conflict maps to 409
- POST order missing maps to 404
- existing 201/400/401/422 behaviors remain covered

### Targeted Test Execution (Branch Validation)

- `npm.cmd run test -- tests/unit/services/refund.service.test.ts tests/unit/controllers/refund.controller.test.ts tests/unit/repositories/refund.repository.test.ts tests/integration/api/refunds.route.test.ts`
- Result on current branch: all targeted suites passed.

---

## Operational Notes

### Security Hardening

- Ownership scope for collection listing is now derived from authenticated user role, not external request fields.
- Non-buyer creation requests are blocked at service layer.

### Backward Compatibility

- Collection route still accepts standard filter fields (`page`, `pageSize`, `status`, etc.).
- Caller-supplied ownership scope fields are no longer consumed at route boundary.

### DB / Migration Impact

- No schema changes were introduced for RFND-04.
- Changes are application-layer behavior and test coverage only.

---

## Checklist

1. GET `/api/refunds` for buyer returns buyer-scoped list.
2. GET `/api/refunds` for seller returns seller-scoped list.
3. GET `/api/refunds` for unauthenticated request returns 401.
4. GET `/api/refunds` invalid query returns 400.
5. POST `/api/refunds` for buyer valid payload returns 201.
6. POST `/api/refunds` for seller/admin/moderator returns 403.
7. POST domain conflict maps to 409.
8. POST missing order maps to 404.
9. Shared mapper is used by both `/api/refunds` and `/api/refunds/[id]`.
10. Route-level error logs include context and code for debugging.

---

## Future Considerations

1. Decide whether admin/moderator should gain scoped or global collection visibility.
2. Decide whether external `buyer_id`/`seller_id` query params should be explicitly rejected with 400 instead of being ignored.
3. Add integration tests for `GET /api/refunds/[id]` shared mapper behavior.
4. Add end-to-end test cases spanning auth role changes and collection access.

---

## Summary

RFND-04 is implemented on this branch as a focused gap-closure release: shared route error handling, role-aware collection access, buyer-only creation guard, internal scope DTO hardening, and expanded unit/integration tests.

The implementation maintains existing architectural boundaries while improving security, consistency, and test confidence for refund collection endpoints.

---

**Document Maintainers:** Development Team  
**Last Reviewed:** April 2026  
**Next Review:** After role policy decision for admin/moderator visibility

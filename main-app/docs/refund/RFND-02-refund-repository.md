# RFND-02: Refund Repository (Create / List / Detail)

**Document Version:** 1.0  
**Status:** Implemented  
**Sprint:** Sprint-4  
**Last Updated:** April 2026

---

## Overview

RFND-02 implements the concrete refund persistence layer using Supabase, aligned with the contracts introduced in RFND-01.

The implementation delivers:

- A concrete `RefundRepository` class implementing `IRefundRepository`
- Strong repository boundary contracts returning refund DTOs (not raw Supabase rows)
- Supabase-backed create/list/detail operations
- Range-based pagination with exact total count
- Repository-local mapping methods for entity and DTO transformations
- Typed repository errors for common DB constraint categories
- Dependency injection support for Supabase client factory

This story is intentionally repository-focused and does not include service business rules, API route handlers, or tests.

---

## User Stories Covered

| Story ID | Title                                                    | Status         |
| -------- | -------------------------------------------------------- | -------------- |
| US-RFND  | Concrete repository supports refund create operation     | ✅ Implemented |
| US-RFND  | Refund list supports typed filters + pagination          | ✅ Implemented |
| US-RFND  | Refund detail supports enriched related data composition | ✅ Implemented |
| US-RFND  | Repository maps DB errors to typed domain-level errors   | ✅ Implemented |
| US-RFND  | Repository boundary hides Supabase query implementation  | ✅ Implemented |

---

## Branch Diff (Current Branch vs main)

Branch:

```bash
feature/refund-repository
```

Name-status diff:

```bash
git diff --name-status main...HEAD

A       main-app/lib/repositories/index.ts
M       main-app/lib/repositories/refund.repository.ts
A       main-app/lib/repositories/refundRepository.ts
```

Stat diff:

```bash
git diff --stat main...HEAD

main-app/lib/repositories/index.ts             |   9 +
main-app/lib/repositories/refund.repository.ts |  53 +-
main-app/lib/repositories/refundRepository.ts  | 705 +++++++++++++++++++++++++
3 files changed, 756 insertions(+), 11 deletions(-)
```

---

## Repository Contract (RFND-01 -> RFND-02)

### File: `lib/repositories/refund.repository.ts`

RFND-02 updates the interface and adds repository-level typed errors:

- `IRefundReadRepository`
  - `findById(refundId): Promise<RefundResponseDTO | null>`
  - `findDetailById(refundId): Promise<RefundDetailDTO | null>`
  - `list(filters): Promise<RefundListResponseDTO>`
- `IRefundWriteRepository`
  - `create(input): Promise<RefundResponseDTO>`

Typed errors introduced:

- `RefundRepositoryError`
- `RefundConflictError`
- `RefundForeignKeyError`
- `RefundConstraintError`

---

## Architecture & Data Flow

### Layer Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  API Route / Server Action / Service Layer                 │
│  (consumes repository interface only)                      │
└─────────────────────────────────┬───────────────────────────┘
																	│
								 ┌────────────────▼────────────────┐
								 │  Repository Contract Layer      │
								 │  lib/repositories/refund.repository.ts
								 └────────────────┬────────────────┘
																	│
								 ┌────────────────▼────────────────┐
								 │  Concrete Repository            │
								 │  lib/repositories/refundRepository.ts
								 │  - query composition            │
								 │  - filter normalization         │
								 │  - row/entity/dto mapping       │
								 │  - error mapping                │
								 └────────────────┬────────────────┘
																	│
								 ┌────────────────▼────────────────┐
								 │  Supabase Client                │
								 │  lib/supabase/server.ts         │
								 └────────────────┬────────────────┘
																	│
								 ┌────────────────▼────────────────┐
								 │  PostgreSQL (refunds, orders,   │
								 │  order_items, users_profile)    │
								 └─────────────────────────────────┘
```

---

## File Structure Map

### New Files Created

```
lib/repositories/
	├─ refundRepository.ts
	│   ├─ class RefundRepository implements IRefundRepository
	│   ├─ create(...)
	│   ├─ list(...)
	│   ├─ findById(...)
	│   ├─ findDetailById(...)
	│   └─ private mapping + filter + relation helpers
	└─ index.ts
			└─ repository barrel exports including refund contracts + concrete class
```

### Modified Files

| File                                    | Changes                                                         | Reason                                           |
| --------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------ |
| `lib/repositories/refund.repository.ts` | Updated repository contract to DTO-based methods + typed errors | Align RFND-02 persistence boundary and consumers |

---

## Implemented Operations

### 1) Create Refund

**Method:** `create(input)`

Behavior:

1. Builds insert payload via `toInsertRow(...)`
2. Inserts into `refunds` using Supabase server client
3. Maps created row -> `Refund` entity -> `RefundResponseDTO`
4. Maps DB errors to typed repository errors

Important note:

- Current generated schema does not expose a dedicated `refund_items` table.
- RFND-02 therefore persists the parent refund row atomically and maps item DTO data within repository mapping boundaries.

### 2) List Refunds (Filters + Pagination)

**Method:** `list(filters)`

Implemented query characteristics:

- Uses `.select('*', { count: 'exact' })`
- Uses `.range(from, to)` pagination
- Supports optional filters when present:
  - `status`
  - `reason_code` (plus validated `reason` alias fallback)
  - `buyer_id` (plus `buyerId` alias fallback)
  - `seller_id` via order-item scope resolution
  - `order_id`
  - `order_item_id`
  - `processed_by`
  - date range via normalized `createdAfter` / `createdBefore` or DTO `dateFrom` / `dateTo`
- Sort handling:
  - default `created_at desc`
  - supports DTO sort literals (`recent`, `oldest`, `amount_high`, `amount_low`)
  - supports `sortOrder` alias override (`asc` / `desc`)

Returns:

- `RefundListResponseDTO` with:
  - `refunds: RefundSummaryDTO[]`
  - `pagination: { page, pageSize, totalCount, totalPages }`

### 3) Refund Detail

**Methods:** `findById(refundId)`, `findDetailById(refundId)`

Implemented behavior:

- Uses `.maybeSingle()` for optional results (returns `null` when not found)
- `findById(...)` returns `RefundResponseDTO`
- `findDetailById(...)` composes `RefundDetailDTO` with related entities:
  - order snapshot from `orders`
  - buyer profile from `users_profile`
  - seller profile resolved through `order_items`
  - line items derived from `order_items`

---

## Mapping Strategy

### Data Mapper Methods (Private)

The repository centralizes transformation logic in private methods:

- `toEntity(row, items)`
- `toResponseDTO(entity)`
- `toDetailDTO(entity, relations)`
- `toInsertRow(input)`
- `toSummaryDTO(entity)`

Supporting helpers:

- `mapRefundItemsFromDTO(...)`
- `mapItemsToDTO(...)`
- `mapEvidenceImages(...)`
- `toJsonStringArrayOrNull(...)`

This keeps Supabase row shapes and JSON nuances fully encapsulated inside repository implementation.

---

## Error Handling Strategy

### Supabase/Postgres Code Mapping

`throwMappedError(...)` maps DB errors to typed repository errors:

- `23505` -> `RefundConflictError`
- `23503` -> `RefundForeignKeyError`
- `23514`, `22001`, `22P02` -> `RefundConstraintError`
- fallback -> `RefundRepositoryError`

This ensures callers can reason about failures without handling raw Supabase error objects directly.

---

## Dependency Injection & Export Surface

### Injection

`RefundRepository` constructor supports injected client factory:

```ts
new RefundRepository(clientFactory?)
```

Default is `createClient` from `lib/supabase/server.ts`.

### Exports

Repository barrel is added:

- `lib/repositories/index.ts`
- Includes exports for existing repositories and new refund repository artifacts.

---

## Constraints & Known Gaps

1. No dedicated `refund_items` table exists in current generated schema.
2. `users_profile` typed shape does not expose `email`; detail DTO currently maps `email: null` for buyer/seller profile summaries.
3. RFND-02 repository is implemented, but service integration and API route wiring are not part of this story.
4. No RFND-02 tests are added in this branch (unit/integration reserved for later story).

---

## Verification Checklist

1. `create(...)` inserts refund and returns `RefundResponseDTO`
2. `list(...)` returns paginated envelope with exact `totalCount`
3. List filters apply only when present
4. Seller-scoped filtering resolves through `order_items`
5. `findById(...)` returns `null` for missing refund
6. `findDetailById(...)` returns relation-enriched `RefundDetailDTO`
7. Supabase errors are mapped to typed repository errors
8. Repository methods return DTOs, not raw Supabase rows
9. Dependency injection path for Supabase client factory exists
10. Repository exports are available through `lib/repositories/index.ts`

---

## Future Considerations

### Not Yet Implemented in RFND-02

1. Transactional parent+child persistence when/if `refund_items` table is introduced
2. Full relation query consolidation for detail path into a single embedded select
3. Service-level authorization and lifecycle business rules (RFND-03)
4. API route handlers for refund endpoints (RFND-04)
5. Dedicated repository unit tests and integration tests (RFND-05)

---

## Summary

RFND-02 delivers a concrete, typed Supabase-backed refund repository implementation that fulfills create/list/detail persistence responsibilities for the refund domain.

Current branch changes include contract refinement, concrete class implementation, and repository exports alignment. The solution follows a repository + data-mapper style, keeps Supabase query details localized, and provides typed error mapping for safer service-layer consumption.

---

**Document Maintainers:** Development Team  
**Last Reviewed:** April 2026  
**Next Review:** After RFND-03 service integration and RFND-05 repository tests

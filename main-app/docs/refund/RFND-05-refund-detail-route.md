# RFND-05 Refund Detail Route

RFND-05 extends `GET /api/refunds/[id]` with scope-aware access control for authenticated buyers and sellers while preserving the existing route, controller, service, repository, and shared error-mapping boundaries.

## Behavior

- `buyer` can read a refund only when `refund.user_id` matches the authenticated user.
- `seller` can read a refund only when the seller owns at least one `order_items` row within the refund scope.
- Single-item refunds are scoped by the exact `order_item_id`.
- Full-order and partial-order refunds are scoped by any matching seller-owned `order_items` row under the same `order_id`.
- Unsupported authenticated roles return `403 FORBIDDEN`.
- Missing refunds return `404 Refund not found`.

## Flow

1. The route validates the refund id as a UUID.
2. The route resolves the authenticated user through `requireAuthenticatedUser`.
3. The controller delegates to the refund service with `userId` and `refundId`.
4. The service resolves the caller role, loads the refund detail, selects a role strategy, and enforces read access.
5. The route maps domain errors through `app/api/refunds/_shared.ts`.

## Strategy Layer

- `buyer-refund-read-access.strategy.ts` enforces initiator ownership.
- `seller-refund-read-access.strategy.ts` delegates seller scope verification to the repository.
- `refund-read-access-strategy-registry.ts` maps supported roles to strategy instances and rejects unsupported roles consistently.

## Tests

- Service unit coverage includes buyer in-scope, buyer out-of-scope, seller in-scope, seller out-of-scope, missing refund, and unsupported role cases.
- Repository unit coverage includes seller detail scope checks for both single-item and order-wide refunds.
- Route integration coverage includes `401`, `400`, `403`, `404`, `500`, buyer success, and seller success outcomes.

## Plan: RFND-05 Refund Detail Scope Access

Implement RFND-05 by extending the existing refund detail endpoint to enforce dual-role scope checks via a dedicated strategy layer while preserving current route/controller/service/repository boundaries and shared refund error mapping.

**Codebase findings**

1. The endpoint already exists at app/api/refunds/[id]/route.ts and currently validates UUID params, resolves auth via requireAuthenticatedUser, delegates to getRefundById, and maps errors via app/api/refunds/\_shared.ts.
2. Current detail access in lib/services/refund.service.ts is buyer-only ownership (`refund.user_id === userId`) and therefore denies legitimate seller-scope access.
3. Collection access (RFND-04) already resolves role in service and applies buyer/seller scoping through repository filters; this is the anchor for continuity.
4. Shared error mapping in app/api/refunds/\_shared.ts already maps FORBIDDEN to 403 and Refund not found to 404; this is the established refund-route convention.
5. Repository already contains seller-scoping primitives for list (`findOrderIdsBySellerId`) and detail relation lookups (`findDetailById` + order_item joins), but lacks an explicit seller-scope predicate for detail authorization.
6. lib/strategies currently has no production strategy implementation, so RFND-05 will introduce the strategy abstraction there.
7. There are no integration tests for GET /api/refunds/[id] yet; existing refund integration tests only cover collection route behavior.

**Files to create**

1. main-app/lib/strategies/refund-read-access/refund-read-access.strategy.ts — Defines the strategy contract for refund detail visibility decisions.
2. main-app/lib/strategies/refund-read-access/buyer-refund-read-access.strategy.ts — Encapsulates buyer-specific predicate (initiator ownership).
3. main-app/lib/strategies/refund-read-access/seller-refund-read-access.strategy.ts — Encapsulates seller-specific predicate (seller owns at least one order item in the refund’s order scope).
4. main-app/lib/strategies/refund-read-access/refund-read-access-strategy-registry.ts — Centralized strategy selection/lookup by role so service does not branch inline.
5. main-app/tests/integration/api/refunds-detail.route.test.ts — Endpoint-level tests for auth/scope/status behavior of GET /api/refunds/[id].
6. main-app/docs/refund/RFND-05-refund-detail-route.md — RFND-05 contract and behavior documentation.

**Files to modify**

1. main-app/lib/services/refund.service.ts — Replace buyer-only ownership check in getRefundDetail with strategy-driven scope evaluation and explicit role-aware read flow.
2. main-app/lib/repositories/refund.repository.ts — Add interface method(s) required by seller strategy for detail-scope verification (and keep DIP-compliant service dependency on interface only).
3. main-app/lib/repositories/refundRepository.ts — Implement new seller-scope verification query method(s) in repository layer.
4. main-app/lib/controllers/refund.controller.ts — Keep thin orchestration but align naming/signature semantics with role-aware detail access path.
5. main-app/app/api/refunds/[id]/route.ts — Keep route thin; ensure sequence aligns with RFND-05 flow and continue using shared refund error mapper.
6. main-app/tests/unit/services/refund.service.test.ts — Add unit coverage for buyer in-scope/out-of-scope and seller in-scope/out-of-scope detail retrieval.
7. main-app/tests/unit/repositories/refund.repository.test.ts — Add repository tests for seller detail-scope predicate query behavior.
8. main-app/tests/unit/controllers/refund.controller.test.ts — Extend delegation assertions if controller contract changes.
9. main-app/app/api/refunds/\_shared.ts — Extend domain error mapping only if new explicit domain errors are introduced for scope strategy failures.

**Type and interface contracts**

1. Refund viewer identity contract at service boundary: minimal typed identity containing userId and role (no Request/session propagation).
2. Refund read-access strategy contract:
   - input: viewer identity + normalized refund detail context
   - output: allow/deny decision (or throws FORBIDDEN according to existing error style)
3. Strategy registry contract:
   - maps supported roles (buyer, seller) to strategy instance
   - unsupported roles fail consistently with FORBIDDEN
4. Repository read contract additions for seller strategy:
   - method to evaluate whether seller is in scope for a given refund
   - must hide query details from service and return a narrow boolean decision
5. Domain error contract:
   - preserve existing literal errors used by mapper: UNAUTHENTICATED, FORBIDDEN, Refund not found
   - keep any new domain error types mappable through centralized refund mapper

**Scope strategy plan**

1. Buyer strategy predicate:
   - authorize only when refund.user_id matches authenticated userId.
   - data source: already-loaded refund detail record.
2. Seller strategy predicate:
   - authorize when seller owns at least one order item that belongs to the refund’s order scope.
   - for single-item refunds: ownership is validated against that order item.
   - for full-order/partial-order refunds: ownership is validated via any matching order_item.seller_id within the related order.
   - data source: repository-level existence query optimized for boolean authorization.
3. Strategy selection:
   - service resolves role once via existing role lookup path.
   - service retrieves strategy via registry (no inline handler branching).
   - strategy executes after refund existence is confirmed.
4. Extensibility:
   - adding new roles later requires adding new strategy implementation and registering it, with no edits to existing buyer/seller strategy logic.

**Auth and guard flow**

1. Route applies reusable auth guard to resolve authenticated user identity and enforce 401 behavior.
2. Route delegates to controller with narrow inputs only (userId + route param id).
3. Controller/service resolves viewer role from repository and constructs typed viewer identity.
4. Service fetches refund detail from repository.
5. If no record exists, service throws Refund not found.
6. If record exists, service invokes role-selected read strategy.
7. Strategy deny results in FORBIDDEN.
8. Route maps thrown errors through shared mapper to 401/403/404/500.

**Parameter validation plan**

1. Keep route-level UUID validation for [id] to stay consistent with existing dynamic-route convention in this codebase (per alignment decision).
2. Validate before repository access and return 400 validation envelope on malformed id.
3. Keep repository free of param-format validation; repository assumes validated identifiers.
4. Service continues to normalize user identity and enforce business-level preconditions.

**Error mapping plan**

1. Maintain centralized mapping in app/api/refunds/\_shared.ts as the single HTTP translation layer.
2. Mapping matrix:
   - UNAUTHENTICATED -> 401
   - Refund not found -> 404
   - FORBIDDEN (exists but out of buyer/seller scope or unsupported role) -> 403
   - validation failure (route schema) -> 400
   - unexpected failure -> 500 safe message
3. 403 vs 404 convention decision:
   - Use 403 for out-of-scope existing refunds, consistent with existing refund shared mapper and current refund service ownership-denial behavior.
   - Use 404 only when refund genuinely does not exist.

**Test plan**

1. Unit tests: service layer
   - buyer in-scope detail -> success
   - buyer out-of-scope detail -> FORBIDDEN
   - seller in-scope detail -> success
   - seller out-of-scope detail -> FORBIDDEN
   - refund missing -> Refund not found
   - unsupported role -> FORBIDDEN
2. Unit tests: repository layer
   - seller scope predicate returns true when seller owns matching order item(s)
   - seller scope predicate returns false when no ownership match
   - edge behavior for single-item refund vs full-order refund scope checks
3. Unit tests: controller layer
   - unchanged delegation path and propagation of service errors
4. Integration tests: GET /api/refunds/[id]
   - unauthenticated -> 401
   - invalid id -> 400
   - buyer in scope -> 200 + payload
   - buyer out of scope -> 403
   - seller in scope -> 200 + payload
   - seller out of scope -> 403
   - refund not found -> 404
   - unexpected error -> 500

**Execution steps**

1. Introduce refund read-access strategy contracts and role strategy registry in lib/strategies. (foundation)
2. Extend repository interface and implementation with seller detail-scope predicate query methods. (depends on 1)
3. Refactor refund detail service flow to role-resolve + strategy-driven authorization. (depends on 1,2)
4. Keep controller/route boundary thin and aligned with updated service contract while preserving shared error mapper usage. (depends on 3)
5. Add/expand unit tests for service/repository/controller behavior. (depends on 2,3,4)
6. Add integration route tests for GET /api/refunds/[id] status and scope matrix. (depends on 4)
7. Update refund docs with RFND-05 endpoint contract and access semantics. (parallel with 5-6)

**Decisions captured**

1. RFND-05 role scope: buyer + seller only (admin/moderator excluded for this ticket).
2. Seller predicate for full-order refunds: allow if seller owns any order item in the refund’s order.
3. ID validation layer: keep route-level UUID validation for consistency with existing dynamic routes.
4. Out-of-scope behavior: 403 (not 404), based on existing refund-route conventions.

**Open questions**

1. Should unsupported authenticated roles continue to map to FORBIDDEN (403) or receive a role-specific domain code for client UX? Recommendation: keep FORBIDDEN for consistency now.
2. Should seller scope check prioritize single-query existence checks for performance over reuse of existing relation-loading methods? Recommendation: use dedicated boolean existence query for RFND-05.
3. Should RFND-05 include documentation of known multi-seller refund visibility semantics in API docs to avoid frontend ambiguity? Recommendation: yes, document explicitly in RFND-05 doc.

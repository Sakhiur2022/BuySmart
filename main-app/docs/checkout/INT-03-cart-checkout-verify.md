# INT-03: Cart to Checkout Integration Verification

**Document Version:** 1.0  
**Status:** Implemented (Verification Complete)  
**Sprint:** Sprint-3  
**Last Updated:** April 2026

---

## Overview

INT-03 verifies and hardens the complete buyer cart to checkout flow for authenticated checkout.

The implementation in this branch focuses on:

- **API contract alignment** between checkout client submission and `POST /api/orders`
- **Correct cart-to-checkout data handling** for cart source orders
- **Session-safe flow behavior** for auth-only checkout routing
- **Stock validation field correctness** against product schema
- **Integration and e2e verification coverage** for critical path and auth edge case

The work preserves the existing layered architecture and existing auth/middleware patterns.

---

## User Stories Covered

| Story ID  | Title                                                      | Status         |
| --------- | ---------------------------------------------------------- | -------------- |
| US-INT-03 | Buyer can proceed from cart to checkout with valid data    | ✅ Implemented |
| US-INT-03 | Checkout request matches order API contract                | ✅ Implemented |
| US-INT-03 | Cart-based checkout handles stock verification correctly   | ✅ Implemented |
| US-INT-03 | Unauthenticated checkout access is blocked by route policy | ✅ Implemented |
| US-INT-03 | Integration tests verify payload and error behavior        | ✅ Implemented |

---

## Git Diff Scope (Current Branch vs main)

### Tracked File Delta

From `git diff main`:

- `M main-app/app/(buyer)/buyer/checkout/page.tsx`
- `M main-app/tests/integration/api/orders.route.test.ts`

### Additional In-Branch New Files

From `git status --short`:

- `?? main-app/docs/checkout/INT-03-cart-checkout-verify.md`
- `?? main-app/tests/integration/checkout.page.test.tsx`
- `?? main-app/tests/e2e/cart-checkout-guard.spec.ts`

### Notes on Commit-Diff

`git diff main...HEAD` returned no output at documentation time, which indicates the branch commit history is aligned with main and the INT-03 work currently resides in working-tree changes.

---

## Contract Verification Findings

### Before Fixes

1. Checkout payload omitted `source: 'cart'` for order creation.
2. Checkout submitted shipping address with `street_address` while API expects `address_line_1` and requires `phone`.
3. Checkout stock verification queried `id` and `stock` columns, while product schema uses `product_id` and `inventory_quantity`.
4. Checkout error parsing expected `message` while API uses `error`.
5. Checkout success handling assumed top-level `order_id` instead of resilient nested order parsing.

### After Fixes

1. Checkout now sends `source: 'cart'` and schema-aligned address fields.
2. Stock verification now uses `product_id` and `inventory_quantity`.
3. Error handling now reads API `error` consistently.
4. Success parsing now validates and resolves `order_id` safely before redirect.
5. Empty cart submit path now has explicit runtime guard in addition to button disabling.

---

## Architecture and Flow Verification

### Verified Flow

```
Cart UI (/buyer/cart)
	-> Checkout navigation (/buyer/checkout)
	-> Checkout form validation
	-> Stock pre-check against products(product_id, inventory_quantity)
	-> POST /api/orders with source='cart' and shipping_address
	-> API/service creates order from cart source
	-> Redirect to /orders/[order_id]/confirmation
```

### Auth Behavior

- Checkout remains **auth-only** by middleware policy.
- Unauthenticated visits to `/buyer/checkout` redirect to `/auth/login`.

### Scope Decision Applied

- Guest checkout creation is out of scope for INT-03.
- Voucher/discount persistence is out of scope for INT-03.

---

## File Structure Map

### Modified Files

```
app/(buyer)/buyer/checkout/page.tsx
	- Address form contract alignment (phone, address_line_1, address_line_2, state)
	- Stock query field fixes (product_id, inventory_quantity)
	- source='cart' order payload
	- Runtime empty-cart guard
	- Error/success response parsing hardening

tests/integration/api/orders.route.test.ts
	- Added cart-source order contract test with schema-aligned shipping address
```

### New Files

```
docs/checkout/INT-03-cart-checkout-verify.md
	- INT-03 implementation and verification document

tests/integration/checkout.page.test.tsx
	- Verifies checkout payload contract and redirect behavior
	- Verifies API error rendering on failed order creation

tests/e2e/cart-checkout-guard.spec.ts
	- Verifies unauthenticated user is redirected from checkout to login
```

---

## Verification Evidence

### Targeted Integration Test Run

Command:

```bash
npm.cmd run test -- tests/integration/checkout.page.test.tsx tests/integration/api/orders.route.test.ts
```

Result:

- 2 test files passed
- 10 tests passed
- 0 failures

### Targeted E2E Test Run

Command:

```bash
npm.cmd run test:e2e -- tests/e2e/cart-checkout-guard.spec.ts
```

Result:

- 1 test passed
- 0 failures

---

## Behavioral Guarantees from INT-03

1. Checkout submission uses order API-compatible payload for cart source.
2. Checkout stock pre-check references existing product schema fields.
3. Empty-cart submissions are blocked at runtime and UI level.
4. Auth error responses are surfaced through standardized API error field.
5. Redirect occurs only when a valid `order_id` can be resolved from response.

---

## Known Constraints and Out-of-Scope

1. Full guest checkout flow is not implemented in this task.
2. Voucher/discount propagation from cart UI into order creation is not covered here.
3. Full happy-path e2e order creation with seeded authenticated session is not included in this specific verification file.

---

## Summary

INT-03 validates and stabilizes the core cart-to-checkout integration for authenticated buyers.

Delivered outcomes include:

- Checkout and orders API contract alignment
- Correct stock-field usage against database schema
- Stronger runtime handling for empty cart, API errors, and order ID parsing
- Added integration and e2e verification for contract and auth guard behavior

This provides a production-ready baseline for the authenticated cart to checkout transition while preserving current architecture and sprint scope constraints.

---

**Document Maintainers:** Development Team  
**Last Reviewed:** April 2026  
**Next Review:** With full authenticated happy-path checkout e2e and optional guest-flow expansion

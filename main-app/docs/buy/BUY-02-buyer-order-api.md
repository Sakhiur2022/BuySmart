# BUY-02: Buyer Order Read APIs

**Document Version:** 1.0  
**Status:** Implemented  
**Sprint:** Sprint-3  
**Last Updated:** April 2026

---

## Overview

BUY-02 implements buyer-facing order read endpoints using the existing layered architecture and Supabase-backed authorization rules. The scope delivered in this branch adds:

- **GET /api/orders** for authenticated buyer order listing
- **GET /api/orders/[id]** for authenticated buyer order detail
- **Pagination and status filtering** on the list endpoint
- **Buyer-role enforcement** in service layer before data read
- **Buyer-scoped repository queries** to prevent cross-user data access
- **Zod validation** for query params and route params

The implementation reuses existing order creation flow and only extends read capabilities.

---

## User Stories Covered

| Story ID | Title                                                | Status         |
| -------- | ---------------------------------------------------- | -------------- |
| US-XX    | Buyer can view all their orders with pagination      | ✅ Implemented |
| US-XX    | Buyer can view single order details by ID            | ✅ Implemented |
| US-XX    | Buyer cannot read orders belonging to other accounts | ✅ Implemented |

---

## Scope from Main Diff

The following changes were identified from current branch vs `main` and working tree:

### Modified Files

- `main-app/app/api/orders/route.ts`
- `main-app/lib/models/order.model.ts`
- `main-app/lib/repositories/order.repository.ts`
- `main-app/lib/services/order.service.ts`

### New Files

- `main-app/app/api/orders/[id]/route.ts`

### No Database Migration Changes in BUY-02

- No new SQL migration file was added.
- No `database.types.ts` update was part of this diff.
- Existing `orders` and `order_items` schema/types were reused.

---

## API Contracts

### GET /api/orders

**Access:** Authenticated user, buyer role only  
**Validation:**

- `page`: positive integer, default `1`
- `pageSize`: integer `1..100`, default `20`
- `status`: enum (`draft|confirmed|processing|shipped|delivered|completed|cancelled`)

**Success Response (200):**

```json
{
  "orders": [
    {
      "order_id": "uuid",
      "buyer_id": "uuid",
      "order_number": "ORD-...",
      "status": "confirmed",
      "payment_status": "pending",
      "subtotal": 120.5,
      "shipping_amount": 10,
      "tax_amount": 5,
      "discount_amount": 0,
      "total_amount": 135.5,
      "currency": "USD",
      "created_at": "...",
      "updated_at": "..."
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalCount": 1,
    "totalPages": 1
  }
}
```

### GET /api/orders/[id]

**Access:** Authenticated user, buyer role only  
**Validation:**

- `id`: UUID (Zod route param schema)

**Success Response (200):**

```json
{
  "order": {
    "order_id": "uuid",
    "buyer_id": "uuid",
    "order_number": "ORD-...",
    "status": "confirmed",
    "payment_status": "pending",
    "total_amount": 135.5,
    "created_at": "...",
    "updated_at": "..."
  },
  "items": [
    {
      "order_item_id": "uuid",
      "order_id": "uuid",
      "product_id": "uuid",
      "seller_id": "uuid",
      "quantity": 1,
      "unit_price": 120.5,
      "total_price": 120.5,
      "status": "confirmed",
      "created_at": "..."
    }
  ]
}
```

---

## Error Handling Behavior

Both endpoints follow existing API response conventions:

- `401`: `Unauthorized: Not authenticated`
- `403`: `Forbidden: Only buyers can access orders`
- `404`: `Order not found`
- `400`: validation failures (`Validation failed` + flattened zod issues)
- `500`: `Internal server error`

---

## Layered Architecture Updates

### Models

**File:** `lib/models/order.model.ts`

Added buyer read contracts:

- `BuyerOrderListFilters`
- `BuyerOrderListResult`
- `BuyerOrderDetailResult`

### Repository

**File:** `lib/repositories/order.repository.ts`

Added read/query functions:

- `fetchBuyerOrdersPaginated(input)`
  - buyer scoped by `buyer_id`
  - optional `status` filter
  - ordered by `created_at DESC`
  - uses Supabase exact count + range pagination
- `fetchOrderByIdForBuyer(orderId, buyerId)`
  - buyer scoped single-order read
- `fetchOrderItemsByOrderId(orderId)`
  - fetches line items for the order

### Service

**File:** `lib/services/order.service.ts`

Added business-layer functions:

- `getBuyerOrders(userId, filters)`
  - normalizes user id
  - enforces buyer role via existing `requireBuyerRole`
  - computes pagination metadata
- `getBuyerOrderById(userId, orderId)`
  - validates non-empty order id
  - enforces buyer role
  - resolves buyer-scoped order
  - returns `{ order, items }`

### API Routes

**Files:**

- `app/api/orders/route.ts`
  - added GET handler
  - retained existing POST handler
  - introduced list query zod schema and status enum constants
  - aligned formatter mapping for new order-read errors
- `app/api/orders/[id]/route.ts` (new)
  - added GET handler for order detail
  - route param UUID zod validation
  - auth + service call + standardized error mapping

---

## Data Flow

### GET /api/orders

1. API route validates query params with zod.
2. API route authenticates user via `requireAuthenticatedUser`.
3. Service verifies buyer role.
4. Repository runs buyer-scoped paginated query.
5. Service returns `orders + pagination`.
6. API returns `200` JSON response.

### GET /api/orders/[id]

1. API route validates `id` param as UUID.
2. API route authenticates user.
3. Service verifies buyer role.
4. Repository fetches buyer-scoped order by id.
5. Repository fetches order items by `order_id`.
6. Service returns `{ order, items }`.
7. API returns `200` or mapped error.

---

## File Structure Map (BUY-02)

### New Files Created

```
app/api/orders/
	└─ [id]/route.ts
			└─ GET /api/orders/[id]
```

### Modified Files

```
app/api/orders/
	└─ route.ts
			├─ GET /api/orders (new)
			└─ POST /api/orders (existing, preserved)

lib/models/
	└─ order.model.ts
			└─ added buyer read/list result interfaces

lib/repositories/
	└─ order.repository.ts
			└─ added buyer-scoped order read functions

lib/services/
	└─ order.service.ts
			└─ added buyer order list/detail service functions
```

---

## Testing Checklist

1. GET `/api/orders` without session returns `401`
2. GET `/api/orders` with non-buyer role returns `403`
3. GET `/api/orders?page=1&pageSize=20` returns `200` with pagination block
4. GET `/api/orders?status=confirmed` filters to matching statuses only
5. GET `/api/orders?page=0` returns `400` validation error
6. GET `/api/orders/[id]` with invalid UUID returns `400`
7. GET `/api/orders/[id]` for non-owned order returns `404`
8. GET `/api/orders/[id]` for owned order returns `200` with `order` and `items`

---

## Constraints and Notes

1. BUY-02 is read-only expansion for buyer orders; no write behavior was added.
2. Existing order creation endpoint remains in place and unchanged in behavior.
3. Authorization is enforced at multiple layers:
   - session auth in API layer
   - buyer role check in service layer
   - buyer_id-scoped data access in repository layer

---

## Summary

BUY-02 successfully adds production-style buyer order read APIs that align with project conventions:

- layered architecture compliance
- strict auth and role enforcement
- zod validation at route boundaries
- consistent response/error shapes
- buyer-scoped secure data reads

The implementation was documented directly from the current branch diff against `main` for exact change traceability.

---

**Document Maintainers:** Development Team  
**Last Reviewed:** April 2026  
**Next Review:** (After buyer order UI integration and endpoint test automation)

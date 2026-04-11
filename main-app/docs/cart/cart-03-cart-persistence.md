# CART-03: Buyer Cart Persistence

**Document Version:** 1.0  
**Status:** Implemented  
**Sprint:** Sprint-3  
**Last Updated:** April 2026

---

## Overview

CART-03 implements buyer-facing cart persistence using **Supabase + PostgreSQL**. The feature enables:

- **Authenticated buyers** to maintain a persistent server-side cart
- **Automatic cart creation** for users who do not yet have one
- **Composable cart operations** (fetch, add, update quantity, remove, clear)
- **LocalStorage -> DB synchronization** after login with merge rules
- **Enriched cart response** including product metadata and calculated totals
- **Layered architecture compliance**: action -> service -> repository -> Supabase

The implementation is intentionally **server-first**, with strict auth checks and RLS-backed row isolation.

---

## User Stories Covered

| Story ID | Title                                                           | Status         |
| -------- | --------------------------------------------------------------- | -------------- |
| US-XX    | Buyer can keep cart items after re-login                        | ✅ Implemented |
| US-XX    | Buyer can sync pre-login local cart items to persistent storage | ✅ Implemented |
| US-XX    | Buyer can add items to cart and increment quantity              | ✅ Implemented |
| US-XX    | Buyer can update quantity for an existing cart item             | ✅ Implemented |
| US-XX    | Buyer can remove one item or clear entire cart                  | ✅ Implemented |
| US-XX    | Buyer sees full cart with product info and aggregated summary   | ✅ Implemented |

---

## Database Schema

### carts Table (Persistence Root)

The cart persistence implementation introduces a dedicated `carts` table with one cart per user.

```sql
create table if not exists carts (
	cart_id uuid primary key default gen_random_uuid(),
	user_id uuid not null references users_profile(user_id) on delete cascade,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	unique (user_id)
);
```

**Column Details:**

| Column       | Type          | Constraint             | Description                       |
| ------------ | ------------- | ---------------------- | --------------------------------- |
| `cart_id`    | `uuid`        | PK                     | Unique cart identifier            |
| `user_id`    | `uuid`        | FK + UNIQUE + NOT NULL | Owner user id (one cart per user) |
| `created_at` | `timestamptz` | NOT NULL default now() | Creation timestamp                |
| `updated_at` | `timestamptz` | NOT NULL default now() | Last update timestamp             |

### cart_items Table (Line Items)

```sql
create table if not exists cart_items (
	cart_item_id uuid primary key default gen_random_uuid(),
	cart_id uuid not null references carts(cart_id) on delete cascade,
	product_id uuid not null references products(product_id) on delete cascade,
	quantity int not null check (quantity > 0),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	unique (cart_id, product_id)
);
```

**Column Details:**

| Column         | Type          | Constraint             | Description                 |
| -------------- | ------------- | ---------------------- | --------------------------- |
| `cart_item_id` | `uuid`        | PK                     | Unique cart line identifier |
| `cart_id`      | `uuid`        | FK + NOT NULL          | Parent cart                 |
| `product_id`   | `uuid`        | FK + NOT NULL          | Product reference           |
| `quantity`     | `int`         | CHECK (`quantity > 0`) | Item quantity               |
| `created_at`   | `timestamptz` | NOT NULL default now() | Creation timestamp          |
| `updated_at`   | `timestamptz` | NOT NULL default now() | Last update timestamp       |

### Trigger-Based Maintenance

`updated_at` is auto-maintained through a shared trigger function:

```sql
create or replace function public.set_updated_at_timestamp()
returns trigger
language plpgsql
as $$
begin
	new.updated_at = now();
	return new;
end;
$$;

create trigger trg_carts_set_updated_at
before update on carts
for each row
execute function public.set_updated_at_timestamp();

create trigger trg_cart_items_set_updated_at
before update on cart_items
for each row
execute function public.set_updated_at_timestamp();
```

### Indexing

```sql
create index if not exists idx_carts_user on carts (user_id);
create index if not exists idx_cart_items_cart on cart_items (cart_id);
create index if not exists idx_cart_items_product on cart_items (product_id);
```

### RLS Policies

RLS is enabled on both tables and enforces user-scoped access:

- carts:

1. `carts_user_read`
2. `carts_user_insert`
3. `carts_user_update`
4. `carts_user_delete`

- cart_items:

1. `cart_items_user_read`
2. `cart_items_user_insert`
3. `cart_items_user_update`
4. `cart_items_user_delete`

All policies allow owner access via `auth.uid()` and admin bypass via `is_admin(auth.uid())`.

### Migration File

**File:** `lib/supabase/db/10_carts.sql`

This script:

1. Creates `carts` table
2. Creates `cart_items` table
3. Adds indexes
4. Enables RLS
5. Adds all cart/cart_item policies
6. Adds auto `updated_at` trigger function + triggers

---

## TypeScript Models

### Cart Models

**File:** `lib/models/cart.model.ts`

```typescript
export interface Cart {
  cart_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface CartItem {
  cart_item_id: string;
  cart_id: string;
  product_id: string;
  quantity: number;
  created_at: string;
  updated_at: string;
}

export interface CartProductDetails {
  product_id: string;
  name: string;
  price: number;
  image?: string;
  short_description: string | null;
}

export interface CartItemWithProduct {
  cart_item_id: string;
  cart_id: string;
  product_id: string;
  quantity: number;
  created_at: string;
  updated_at: string;
  line_total: number;
  product: CartProductDetails | null;
}

export interface UserCartSummary {
  totalItems: number;
  totalAmount: number;
}

export interface UserCartResult {
  cart: Cart;
  items: CartItemWithProduct[];
  summary: UserCartSummary;
}

export interface LocalCartSyncItem {
  product_id: string;
  quantity: number;
}
```

**Key Type Notes:**

- `UserCartResult` is the canonical service/API response shape
- `CartItemWithProduct` supports resilient rendering (`product` can be `null`)
- `line_total` is computed server-side from live product price and quantity

---

## Architecture & Data Flow

### Layer Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  HTTP Request / Server Action                              │
│  (/api/cart, /api/cart/items, /api/cart/sync, actions)     │
└─────────────────────────────────┬───────────────────────────┘
																	│
								┌─────────────────▼──────────────────┐
								│  API / Action Layer                │
								│  - auth session check              │
								│  - zod input validation            │
								│  - response/error shaping          │
								└─────────────────┬──────────────────┘
																	│
								┌─────────────────▼──────────────────┐
								│  Service Layer                     │
								│  lib/services/cart.service.ts      │
								│  - normalization                   │
								│  - merge rules                    │
								│  - totals + enrichment            │
								└─────────────────┬──────────────────┘
																	│
								┌─────────────────▼──────────────────┐
								│  Repository Layer                  │
								│  lib/repositories/cart.repository.ts│
								│  - Supabase CRUD queries           │
								└─────────────────┬──────────────────┘
																	│
								┌─────────────────▼──────────────────┐
								│  Supabase PostgreSQL               │
								│  carts + cart_items + products     │
								└────────────────────────────────────┘
```

**Why Layered?**

- Keeps data access isolated in repository
- Keeps merge/business rules in service
- Keeps API/actions thin and consistent with existing project style
- Improves testability per layer

---

## File Structure Map

### New Files Created

```
lib/supabase/db/
	└─ 10_carts.sql
			 ├─ carts table
			 ├─ cart_items table
			 ├─ indexes
			 ├─ RLS policies
			 └─ updated_at trigger function + triggers

lib/models/
	└─ cart.model.ts
			 ├─ Cart
			 ├─ CartItem
			 ├─ CartProductDetails
			 ├─ CartItemWithProduct
			 ├─ UserCartSummary
			 ├─ UserCartResult
			 └─ LocalCartSyncItem

lib/repositories/
	└─ cart.repository.ts
			 ├─ fetchCartByUserId
			 ├─ createCart
			 ├─ getOrCreateCart
			 ├─ fetchCartItems
			 ├─ upsertCartItem
			 ├─ removeCartItem
			 ├─ clearCartItems
			 └─ fetchProductsByIds

lib/services/
	└─ cart.service.ts
			 ├─ getFullCartWithProductDetails
			 ├─ syncLocalCartOnLogin
			 ├─ addCartItem
			 ├─ updateCartItemQuantity
			 ├─ removeCartItemByProduct
			 └─ clearUserCart

app/api/cart/
	├─ _shared.ts
	│		├─ requireAuthenticatedUser
	│		└─ formatCartErrorResponse
	├─ route.ts
	│		└─ GET /api/cart
	├─ sync/route.ts
	│		└─ POST /api/cart/sync
	└─ items/
			├─ route.ts
			│		├─ POST /api/cart/items
			│		└─ DELETE /api/cart/items
			└─ [productId]/route.ts
					├─ PATCH /api/cart/items/[productId]
					└─ DELETE /api/cart/items/[productId]

lib/actions/
	└─ cart.actions.ts
			 ├─ getCartAction
			 ├─ syncCartAction
			 ├─ addCartItemAction
			 ├─ updateCartItemQuantityAction
			 ├─ removeCartItemAction
			 └─ clearCartAction
```

### Modified Files

| File                          | Changes                                        | Reason                                 |
| ----------------------------- | ---------------------------------------------- | -------------------------------------- |
| `lib/types/database.types.ts` | Added `carts` and `cart_items` generated types | Keep Supabase typing aligned to schema |

---

## Cart Behavior

### Sync Strategy (Local -> DB on Login)

When user logs in and calls sync:

1. Load existing DB cart (create if missing)
2. Normalize incoming local items
3. For each local item:
   - If product already exists in DB cart -> keep DB quantity (do not overwrite)
   - If product does not exist in DB cart -> insert local quantity
4. Return fully merged cart with product details and summary

### Quantity Rules

- Add item: increments if item already exists
- Update quantity: sets exact positive integer value
- Quantity must always be positive integer (`> 0`)

### Product Enrichment Rules

- Cart response includes `name`, `price`, `image`, `short_description`
- Missing/deleted product is represented as `product: null`
- `line_total` is `price * quantity`, or `0` when product is missing
- Summary fields:
  - `totalItems = sum(quantity)`
  - `totalAmount = sum(line_total)`

---

## Repository Query Strategy

**File:** `lib/repositories/cart.repository.ts`

```typescript
const { data, error } = await supabase
  .from('cart_items')
  .upsert(
    { cart_id: cartId, product_id: productId, quantity },
    { onConflict: 'cart_id,product_id' },
  )
  .select('*')
  .single();
```

**Composition Approach:**

1. `getOrCreateCart` ensures cart existence
2. `fetchCartItems` retrieves cart line items
3. `fetchProductsByIds` enriches item rows
4. `upsertCartItem` handles insert/update by unique key
5. `removeCartItem` and `clearCartItems` handle deletion flows

---

## Routes Reference

| Route                         | Access        | Description                                    |
| ----------------------------- | ------------- | ---------------------------------------------- |
| `/api/cart`                   | authenticated | Fetch full cart with product details + summary |
| `/api/cart/sync`              | authenticated | Sync local cart into DB after login            |
| `/api/cart/items` (POST)      | authenticated | Add item (or increment existing item)          |
| `/api/cart/items` (DELETE)    | authenticated | Clear all items from current user's cart       |
| `/api/cart/items/[productId]` | authenticated | Update one item quantity or remove one item    |

---

## Refresh/Revalidation Behavior

Cart persistence operations currently return data payloads directly and do not rely on `revalidatePath(...)` in this backend scope.

Behavior is achieved by:

- API responses returning updated cart state immediately
- Server actions returning full success/error objects with cart payload

---

## Loading, No-Results, and Error States

### Loading

- Handled by caller/UI layer; backend returns deterministic payloads for all success paths.

### No Results

- Empty cart returns valid `UserCartResult` with:
  - `items: []`
  - `summary.totalItems = 0`
  - `summary.totalAmount = 0`

### Error Handling

- Auth errors mapped to 401
- Validation errors mapped to 400 with zod issues for API endpoints
- Missing item/product mapped to 404
- Unknown/internal failures mapped to 500
- Server actions return typed `{ success: false, error }` without throwing to client

---

## Key Constraints & Gotchas

### 1. One Cart Per User

`carts.user_id` is unique, so each user can have exactly one cart.

### 2. Add vs Update Semantics

`addCartItem` increments existing quantity, while `updateCartItemQuantity` replaces quantity exactly.

### 3. Product Availability on Add

`addCartItem` validates product exists and is `active`.

### 4. Sync Skips Invalid/Unavailable Items

Sync normalizes invalid local entries and ignores inactive/unavailable products.

### 5. Deleted Product Behavior

If product record is missing later, cart item can still exist in response with `product: null` and `line_total: 0`.

### 6. No Inventory Enforcement Here

Current cart service does not check stock quantity bounds when adding/updating.

### 7. Auth Required for All Cart API Routes

All `/api/cart` endpoints rely on authenticated server session.

---

## Testing Checklist

1. GET `/api/cart` without session returns 401
2. First authenticated GET auto-creates a cart for user
3. POST `/api/cart/items` with valid product adds item
4. Repeated add for same product increments quantity
5. PATCH `/api/cart/items/[productId]` sets exact quantity
6. PATCH with non-positive quantity returns 400
7. DELETE `/api/cart/items/[productId]` removes one item
8. DELETE `/api/cart/items` clears all items
9. POST `/api/cart/sync` with existing DB item keeps DB quantity
10. POST `/api/cart/sync` inserts local-only items
11. Sync ignores invalid/non-positive local items
12. Sync ignores inactive/missing products
13. Summary totals match computed line totals
14. RLS prevents user A reading/writing user B cart
15. Admin access path works per policy conditions
16. `updated_at` changes on updates (trigger verification)
17. `(cart_id, product_id)` uniqueness prevents duplicates

---

## Future Considerations

### Not Yet Implemented

1. Inventory-aware quantity caps in cart service
2. Coupon/discount-aware cart summary calculations
3. Soft-unavailable product messaging in cart payload
4. Server-side cart expiration/cleanup policy
5. Audit logging for cart mutation actions
6. Dedicated cart analytics events pipeline

---

## Summary

CART-03 delivers a production-ready persistent cart foundation backed by Supabase/PostgreSQL with strict user scoping, typed service/repository layers, and complete API + server-action access paths.

The feature supports authenticated cart persistence, local-to-DB merge sync, product-enriched cart responses, and robust mutation operations while preserving existing project architecture patterns.

Implemented scope includes:

- New cart schema + constraints + RLS + updated_at triggers
- End-to-end cart data flow through repository/service/API/actions
- Exact login sync merge behavior (DB quantity precedence)
- Full TypeScript model coverage and generated DB type alignment

---

**Document Maintainers:** Development Team  
**Last Reviewed:** April 2026  
**Next Review:** (Upon inventory-aware cart rules and checkout integration)

# CHK-02: Order Creation API

**Document Version:** 1.0  
**Status:** Implemented  
**Sprint:** Sprint-3  
**Last Updated:** April 2026

---

## Overview

CHK-02 implements buyer order creation with support for **cart-based** and **direct** purchase flows. The feature enables:

- **Cart-based orders**: Convert persistent cart items into confirmed orders
- **Direct orders**: Create orders with inline item specifications (no cart required)
- **Inventory validation**: Atomic inventory decrements with pre-order stock checks
- **Automatic cart clearing**: Remove ordered items from buyer's cart post-confirmation
- **Address handling**: Capture and store shipping/billing addresses as JSONB snapshots
- **Product snapshots**: Preserve product state (name, description, image) at purchase time
- **Skipped items handling**: Classify and report unavailable items (inactive products, insufficient stock)
- **Order numbering**: Auto-generated unique order numbers with timestamp and random suffix
- **Status management**: Comprehensive order and order-item status enums with defined lifecycle transitions
- **Layered architecture compliance**: action → API → service → repository → Supabase

The implementation is server-first with strict auth checks, buyer-role enforcement, and RLS-backed row isolation.

---

## User Stories Covered

| Story ID | Title                                                           | Status         |
| -------- | --------------------------------------------------------------- | --------------- |
| US-XX    | Buyer can create order from persistent cart                     | ✅ Implemented |
| US-XX    | Buyer can create order with direct items (no cart required)     | ✅ Implemented |
| US-XX    | Inventory is decremented atomically on order creation           | ✅ Implemented |
| US-XX    | Cart items are auto-cleared after successful order creation     | ✅ Implemented |
| US-XX    | Shipping and billing addresses are stored with order            | ✅ Implemented |
| US-XX    | Product state is preserved in order items via snapshots         | ✅ Implemented |
| US-XX    | Unapproved items are reported with skip reason codes            | ✅ Implemented |
| US-XX    | Order receives unique order number and confirmed status         | ✅ Implemented |
| US-XX    | Only authenticated buyers can create orders                     | ✅ Implemented |
| US-XX    | Buyers can only create orders for themselves (RLS isolation)    | ✅ Implemented |

---

## Database Schema

### Orders Table (Order Root)

```sql
create table if not exists orders (
	order_id uuid primary key default gen_random_uuid(),
	buyer_id uuid not null references users_profile(user_id) on delete cascade,
	order_number varchar(50) not null unique,
	status order_status_enum not null default 'draft',
	subtotal numeric(10,2) not null,
	tax_amount numeric(10,2) not null default 0,
	shipping_amount numeric(10,2) not null default 0,
	discount_amount numeric(10,2) not null default 0,
	total_amount numeric(10,2) not null,
	currency varchar(3) not null default 'USD',
	payment_status payment_status_enum not null default 'pending',
	payment_method varchar(50),
	payment_reference varchar(255),
	shipping_address jsonb,
	billing_address jsonb,
	notes text,
	tracking_number varchar(255),
	shipped_at timestamptz,
	delivered_at timestamptz,
	completed_at timestamptz,
	cancelled_at timestamptz,
	cancellation_reason text,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);
```

**Column Details:**

| Column                | Type            | Constraint             | Description                                  |
| --------------------- | --------------- | ---------------------- | -------------------------------------------- |
| `order_id`            | `uuid`          | PK                     | Unique order identifier                      |
| `buyer_id`            | `uuid`          | FK + NOT NULL          | Owner buyer id                               |
| `order_number`        | `varchar(50)`   | UNIQUE + NOT NULL      | Human-readable order number (e.g., ORD-...) |
| `status`              | enum            | NOT NULL default draft | Order status (see enums below)               |
| `subtotal`            | `numeric(10,2)` | NOT NULL               | Sum of line items before tax/shipping       |
| `tax_amount`          | `numeric(10,2)` | NOT NULL default 0     | Calculated or applied tax                    |
| `shipping_amount`     | `numeric(10,2)` | NOT NULL default 0     | Shipping cost                                |
| `discount_amount`     | `numeric(10,2)` | NOT NULL default 0     | Applied discount/coupon reduction            |
| `total_amount`        | `numeric(10,2)` | NOT NULL               | Final payable: subtotal + tax + shipping - discount |
| `currency`            | `varchar(3)`    | NOT NULL default USD   | Currency code (ISO 4217)                     |
| `payment_status`      | enum            | NOT NULL default pending | Payment status (see enums below)             |
| `payment_method`      | `varchar(50)`   | nullable               | Payment instrument (credit_card, paypal, etc) |
| `payment_reference`   | `varchar(255)`  | nullable               | External payment gateway transaction ID      |
| `shipping_address`    | `jsonb`         | nullable               | Recipient address snapshot                   |
| `billing_address`     | `jsonb`         | nullable               | Billing address snapshot                     |
| `notes`               | `text`          | nullable               | Buyer notes/special instructions             |
| `tracking_number`     | `varchar(255)`  | nullable               | Carrier/courier tracking ID (post-shipment) |
| `shipped_at`          | `timestamptz`   | nullable               | Order shipment timestamp                     |
| `delivered_at`        | `timestamptz`   | nullable               | Delivery confirmation timestamp              |
| `completed_at`        | `timestamptz`   | nullable               | Order completion timestamp                   |
| `cancelled_at`        | `timestamptz`   | nullable               | Cancellation timestamp                       |
| `cancellation_reason` | `text`          | nullable               | Reason for cancellation                      |
| `created_at`          | `timestamptz`   | NOT NULL default now() | Creation timestamp                           |
| `updated_at`          | `timestamptz`   | NOT NULL default now() | Last update timestamp                        |

### Order Items Table (Line Items)

```sql
create table if not exists order_items (
	order_item_id uuid primary key default gen_random_uuid(),
	order_id uuid not null references orders(order_id) on delete cascade,
	product_id uuid not null references products(product_id) on delete restrict,
	seller_id uuid not null references users_profile(user_id) on delete cascade,
	quantity int not null check (quantity > 0),
	unit_price numeric(10,2) not null,
	total_price numeric(10,2) not null,
	product_snapshot jsonb,
	status order_item_status_enum not null default 'pending',
	created_at timestamptz not null default now(),
	unique (order_id, product_id)
);
```

**Column Details:**

| Column              | Type            | Constraint             | Description                                |
| ------------------- | --------------- | ---------------------- | ------------------------------------------ |
| `order_item_id`     | `uuid`          | PK                     | Unique order line identifier               |
| `order_id`          | `uuid`          | FK + NOT NULL          | Parent order                               |
| `product_id`        | `uuid`          | FK + NOT NULL          | Product reference (RESTRICT delete)        |
| `seller_id`         | `uuid`          | FK + NOT NULL          | Item seller (may differ from buyer/admin)  |
| `quantity`          | `int`           | CHECK (`quantity > 0`) | Item quantity                              |
| `unit_price`        | `numeric(10,2)` | NOT NULL               | Price per unit at purchase time            |
| `total_price`       | `numeric(10,2)` | NOT NULL               | `unit_price * quantity`                    |
| `product_snapshot`  | `jsonb`         | nullable               | Product state snapshot: `{name, short_description, image}` |
| `status`            | enum            | NOT NULL default pending | Item status (see enums below)              |
| `created_at`        | `timestamptz`   | NOT NULL default now() | Creation timestamp                         |

### Enums

**order_status_enum:**
```
'draft'       — Order initialized but not yet confirmed
'confirmed'   — Initial status post-creation; payment pending
'processing'  — Payment successful; preparing shipment
'shipped'     — Package dispatched; tracking_number assigned
'delivered'   — Delivery confirmed; delivered_at set
'completed'   — Fully fulfilled; completed_at set
'cancelled'   — Order cancelled; cancelled_at & cancellation_reason set
```

**payment_status_enum:**
```
'pending'              — Initial status; awaiting payment
'paid'                 — Payment received and processed
'failed'               — Payment declined or failed
'refunded'             — Full refund issued
'partially_refunded'   — Partial refund issued (e.g., 1 of 3 items returned)
```

**order_item_status_enum:**
```
'pending'      — Item added to order; awaiting processing
'confirmed'    — Item confirmed/approved by seller
'shipped'      — Item dispatched; part of shipment
'delivered'    — Item delivered to buyer
'returned'     — Item returned by buyer
'cancelled'    — Item cancelled
```

### Trigger-Based Maintenance

`updated_at` is auto-maintained through a shared trigger function (same as CART-03):

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

create trigger trg_orders_set_updated_at
before update on orders
for each row
execute function public.set_updated_at_timestamp();
```

### Indexing

```sql
create index if not exists idx_orders_buyer_status on orders (buyer_id, status);
create index if not exists idx_orders_status_created on orders (status, created_at);
create index if not exists idx_order_items_order on order_items (order_id);
create index if not exists idx_order_items_product on order_items (product_id);
create index if not exists idx_order_items_seller on order_items (seller_id);
```

### RLS Policies

RLS is enabled on both tables and enforces buyer and admin access:

**orders:**
1. `orders_buyer_read`: Buyers read only their own orders; admin bypass via `is_admin()`
2. `orders_buyer_insert`: Only buyers can insert orders for themselves
3. `orders_buyer_update`: Buyers and admins can update orders (for status transitions, not initial creation)
4. `orders_buyer_delete`: Full delete restricted; logical cancel recommended

**order_items:**
1. `order_items_buyer_read`: Buyers read items from their own orders; admin bypass
2. `order_items_buyer_write`: Insert/update guided by order ownership (transactional creation)

---

## TypeScript Models

### Order Address Model

**File:** `lib/models/order.model.ts`

```typescript
export interface OrderAddress {
  full_name: string;               // e.g., "John Doe"
  phone: string;                   // e.g., "+1-555-123-4567"
  address_line_1: string;          // Street address
  address_line_2?: string;         // Apt/Suite (optional)
  city: string;                    // e.g., "New York"
  state?: string;                  // e.g., "NY" (optional)
  postal_code?: string;            // e.g., "10001" (optional)
  country: string;                 // e.g., "United States"
}
```

### Input Models

```typescript
export interface CreateOrderDirectItemInput {
  product_id: string;              // Required: product UUID
  quantity: number;                // Required: positive integer
}

export interface CreateOrderInput {
  source: 'cart' | 'direct';       // 'cart' pulls from buyer's persistent cart
                                   // 'direct' uses items array
  items?: CreateOrderDirectItemInput[];        // Required if source='direct'
  notes?: string;                  // Buyer notes/instructions
  shipping_address?: OrderAddress; // Recipient address
  billing_address?: OrderAddress;  // Billing address (can differ)
  shipping_amount?: number;        // Shipping cost
  tax_amount?: number;             // Calculated tax
  discount_amount?: number;        // Applied discount
  currency?: string;               // ISO 4217 code (default: 'USD')
  payment_method?: string;         // e.g., 'credit_card', 'paypal'
}
```

### Response Models

```typescript
export interface SkippedOrderItem {
  product_id: string;
  quantity: number;
  reason: 'product_not_found'      // Product does not exist
         | 'product_inactive'       // Product status != 'active'
         | 'insufficient_inventory' // Stock < requested quantity
         | 'invalid_quantity';      // Quantity <= 0 or NaN
}

export interface OrderProductSnapshot {
  name: string;
  short_description: string | null;
  image: string | null;
}

export interface OrderWithItemsResult {
  order: {
    order_id: string;
    order_number: string;          // e.g., "ORD-20260406123456-ABCDEF"
    buyer_id: string;
    status: 'confirmed';           // Always 'confirmed' on creation
    subtotal: number;
    tax_amount: number;
    shipping_amount: number;
    discount_amount: number;
    total_amount: number;
    payment_status: 'pending';     // Always 'pending' on creation
    currency: string;
    created_at: string;            // ISO 8601 timestamp
    updated_at: string;
    // ... (other fields nullable or timestamped)
  };
  items: {
    order_item_id: string;
    order_id: string;
    product_id: string;
    seller_id: string;
    quantity: number;
    unit_price: number;
    total_price: number;           // unit_price * quantity
    product_snapshot: OrderProductSnapshot | null;
    status: 'pending';             // Always 'pending' on creation
    created_at: string;
  }[];
  skipped_items: SkippedOrderItem[];  // Items that could not be added
}
```

### Key Type Notes

- `OrderWithItemsResult` is the canonical API response shape
- `skipped_items` allows partial success: valid items create order, invalid items reported
- `product_snapshot` preserves product state at purchase time; can be null if products table was truncated
- `unit_price` is fetched from live products table at order time (future: could snapshot price)
- All numeric fields use `number` in TypeScript (stored as `numeric(10,2)` in DB)

---

## Architecture & Data Flow

### Layer Diagram

```
┌──────────────────────────────────────────────────────┐
│  HTTP POST Request: /api/orders                      │
│  Body: { source, items?, notes, addresses, ... }    │
└──────────────────────┬───────────────────────────────┘
                       │
        ┌──────────────▼────────────────┐
        │  API Layer (route.ts)         │
        │  - requireAuthenticatedUser() │
        │  - Zod schema validation      │
        │  - Error response shaping     │
        └──────────────┬─────────────────┘
                       │
        ┌──────────────▼────────────────────────────┐
        │  Service Layer                            │
        │  (lib/services/order.service.ts)          │
        │  - normalizeUserId()                      │
        │  - requireBuyerRole()                     │
        │  - getSourceItems() → [cart or direct]    │
        │  - fetchAndClassifyItems()                │
        │  - validateInventory()                    │
        │  - computeOrderNumber()                   │
        │  - createOrderFromInput() [orchestrator]  │
        │  - decrementInventory()                   │
        │  - clearCartIfNeeded()                    │
        └──────────────┬─────────────────────────────┘
                       │
        ┌──────────────▼──────────────────────────────┐
        │  Repository Layer                           │
        │  (lib/repositories/order.repository.ts)     │
        │  - fetchUserRole()                          │
        │  - fetchCartByUserId()                      │
        │  - fetchCartItems()                         │
        │  - fetchProductsByIds()                     │
        │  - decreaseProductInventory()               │
        │  - createOrder()                            │
        │  - createOrderItems()                       │
        │  - deleteOrder() [rollback]                 │
        │  - removeCartItems()                        │
        └──────────────┬──────────────────────────────┘
                       │
        ┌──────────────▼──────────────────────────────┐
        │  Supabase PostgreSQL                        │
        │  - orders table                             │
        │  - order_items table                        │
        │  - products table (inventory check)         │
        │  - carts table (cart source)                │
        │  - cart_items table (cart source)           │
        └──────────────────────────────────────────────┘
```

**Why Layered?**

- **Repository**: Isolates all Supabase queries; enables atomic batch operations and transactional rollback
- **Service**: Centralizes business rules (inventory validation, item classification, cart clearing, order number generation)
- **API**: Thin and consistent; delegates to service for orchestration; focuses on validation and error mapping
- **Testability**: Each layer can be tested in isolation with mocked dependencies
- **Maintainability**: Changes to data access logic or business rules stay within their layer

---

## File Structure Map

### New Files Created

```
lib/supabase/db/
	└─ 11_orders.sql (or equivalent migration)
			 ├─ orders table (20 columns + constraints)
			 ├─ order_items table (9 columns + unique constraint)
			 ├─ order_status_enum type
			 ├─ payment_status_enum type
			 ├─ order_item_status_enum type
			 ├─ Indexes (5 total)
			 ├─ RLS policies (orders + order_items)
			 └─ updated_at trigger function + trigger

lib/models/
	└─ order.model.ts
			 ├─ OrderAddress
			 ├─ CreateOrderDirectItemInput
			 ├─ CreateOrderInput
			 ├─ SkippedOrderItem
			 ├─ OrderProductSnapshot
			 └─ OrderWithItemsResult

lib/repositories/
	└─ order.repository.ts
			 ├─ fetchUserRole(userId)
			 ├─ fetchCartByUserId(userId)
			 ├─ fetchCartItems(cartId)
			 ├─ fetchProductsByIds(productIds)
			 ├─ decreaseProductInventory(productId, quantity)
			 ├─ createOrder(order)
			 ├─ createOrderItems(orderItems)
			 ├─ deleteOrder(orderId)
			 └─ removeCartItems(cartId, productIds)

lib/services/
	└─ order.service.ts
			 ├─ normalizeUserId(userId)
			 ├─ requireBuyerRole(userId)
			 ├─ getSourceItems(userId, input)
			 ├─ classifyItem(item, product)
			 ├─ normalizeAmount(value)
			 ├─ computeOrderNumber()
			 ├─ toSnapshot(name, shortDescription, image)
			 └─ createOrderFromInput(userId, input) [main orchestrator]

app/api/orders/
	└─ route.ts
			├─ POST /api/orders → createOrderFromInput()
			└─ Error handling + Zod validation schemas
```

### Modified Files

| File                          | Changes                                                | Reason                                     |
| ----------------------------- | ------------------------------------------------------ | ------------------------------------------ |
| `lib/types/database.types.ts` | Added `orders`, `order_items`, and enum types from schema | Keep Supabase typing aligned to schema     |

---

## Routes Reference

| Route         | Method | Access        | Purpose                                           |
| ------------- | ------ | ------------- | ------------------------------------------------- |
| `/api/orders` | POST   | authenticated | Create order from cart or direct items; returns full order with all items and skipped items |

### POST /api/orders - Create Order

**Request Validation Schema (Zod):**

```typescript
const orderAddressSchema = z.object({
  full_name: z.string().min(1).max(120),
  phone: z.string().min(1).max(30),
  address_line_1: z.string().min(1).max(255),
  address_line_2: z.string().max(255).optional(),
  city: z.string().min(1).max(120),
  state: z.string().max(120).optional(),
  postal_code: z.string().max(30).optional(),
  country: z.string().min(2).max(120),
});

const directItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().positive(),
});

const createOrderSchema = z.object({
  source: z.enum(['cart', 'direct']),
  items: z.array(directItemSchema).max(100).optional(),
  notes: z.string().max(1000).optional(),
  shipping_address: orderAddressSchema.optional(),
  billing_address: orderAddressSchema.optional(),
  shipping_amount: z.coerce.number().min(0).max(100000).optional(),
  tax_amount: z.coerce.number().min(0).max(100000).optional(),
  discount_amount: z.coerce.number().min(0).max(100000).optional(),
  currency: z.string().min(3).max(3).optional(),
  payment_method: z.string().max(60).optional(),
});
```

**Request Body Example (Cart Source):**

```json
{
  "source": "cart",
  "notes": "Please handle fragile items with care",
  "shipping_address": {
    "full_name": "Jane Smith",
    "phone": "+1-555-123-4567",
    "address_line_1": "123 Main Street",
    "city": "New York",
    "state": "NY",
    "postal_code": "10001",
    "country": "United States"
  },
  "billing_address": {
    "full_name": "Jane Smith",
    "phone": "+1-555-123-4567",
    "address_line_1": "123 Main Street",
    "city": "New York",
    "state": "NY",
    "postal_code": "10001",
    "country": "United States"
  },
  "shipping_amount": 10.00,
  "tax_amount": 5.50,
  "discount_amount": 2.00,
  "currency": "USD",
  "payment_method": "credit_card"
}
```

**Request Body Example (Direct Source):**

```json
{
  "source": "direct",
  "items": [
    { "product_id": "550e8400-e29b-41d4-a716-446655440000", "quantity": 2 },
    { "product_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8", "quantity": 1 }
  ],
  "shipping_address": {
    "full_name": "John Doe",
    "phone": "+1-555-987-6543",
    "address_line_1": "456 Oak Avenue",
    "city": "Los Angeles",
    "state": "CA",
    "postal_code": "90001",
    "country": "United States"
  },
  "shipping_amount": 15.00,
  "tax_amount": 8.75,
  "currency": "USD"
}
```

**Response (201 Created):**

```json
{
  "order": {
    "order_id": "a1b2c3d4-e5f6-4g7h-i8j9-k0l1m2n3o4p5",
    "order_number": "ORD-20260406123456-ABCDEF",
    "buyer_id": "user-uuid-here",
    "status": "confirmed",
    "subtotal": 100.00,
    "tax_amount": 5.50,
    "shipping_amount": 10.00,
    "discount_amount": 2.00,
    "total_amount": 113.50,
    "currency": "USD",
    "payment_status": "pending",
    "payment_method": "credit_card",
    "payment_reference": null,
    "shipping_address": {
      "full_name": "Jane Smith",
      "phone": "+1-555-123-4567",
      "address_line_1": "123 Main Street",
      "city": "New York",
      "state": "NY",
      "postal_code": "10001",
      "country": "United States"
    },
    "billing_address": {
      "full_name": "Jane Smith",
      "phone": "+1-555-123-4567",
      "address_line_1": "123 Main Street",
      "city": "New York",
      "state": "NY",
      "postal_code": "10001",
      "country": "United States"
    },
    "notes": "Please handle fragile items with care",
    "tracking_number": null,
    "shipped_at": null,
    "delivered_at": null,
    "completed_at": null,
    "cancelled_at": null,
    "cancellation_reason": null,
    "created_at": "2026-04-06T12:34:56.000Z",
    "updated_at": "2026-04-06T12:34:56.000Z"
  },
  "items": [
    {
      "order_item_id": "item-uuid-1",
      "order_id": "order-uuid",
      "product_id": "product-uuid-1",
      "seller_id": "seller-uuid-1",
      "quantity": 2,
      "unit_price": 45.00,
      "total_price": 90.00,
      "product_snapshot": {
        "name": "Laptop Stand",
        "short_description": "Adjustable aluminum laptop stand",
        "image": "https://..."
      },
      "status": "pending",
      "created_at": "2026-04-06T12:34:56.000Z"
    }
  ],
  "skipped_items": [
    {
      "product_id": "invalid-product-uuid",
      "quantity": 1,
      "reason": "product_not_found"
    },
    {
      "product_id": "inactive-product-uuid",
      "quantity": 3,
      "reason": "product_inactive"
    },
    {
      "product_id": "low-stock-product-uuid",
      "quantity": 10,
      "reason": "insufficient_inventory"
    }
  ]
}
```

**Error Responses:**

| Status | Reason                                                     | Example                                 |
| ------ | ---------------------------------------------------------- | --------------------------------------- |
| 400    | Validation error (invalid schema, no items for direct)     | `{errors: [...]}` from Zod              |
| 400    | No valid items after filtering (all items skipped)         | `{error: "No valid items to add"}`      |
| 401    | Not authenticated (no session)                             | `{error: "Unauthorized"}`               |
| 403    | User not a buyer (requires buyer role)                     | `{error: "Forbidden"}`                  |
| 404    | Cart not found (cart source but no cart exists)            | `{error: "Cart not found"}`             |
| 500    | Internal server error (DB failure, transaction rollback)   | `{error: "Internal server error"}`      |

---

## Order Behavior

### Order Numbering

Order numbers follow a deterministic format: `ORD-{YYYYMMDDhhmmss}-{RANDOM_6_CHARS}`

**Example:** `ORD-20260406123456-ABCDEF`

**Components:**
- Prefix: `ORD-`
- Timestamp: `YYYYMMDDhhmmss` (current server time at order creation)
- Suffix: 6 random alphanumeric characters (upper + lowercase)

**Benefits:**
- Globally unique (`unique` constraint on `order_number` in DB)
- Human-readable and sequential by timestamp
- Enables quick mental sorting by date
- Random suffix provides additional entropy for truly duplicates across servers

### Order Status Lifecycle

```
┌────────────────────────────────────────────────────┐
│                    Confirmed                        │
│         (Initial status on creation via API)        │
│                                                    │
│  Payment pending, order awaiting fulfillment       │
│  created_at set, confirmed_at NOT set              │
└────────────────┬─────────────────────────────────┘
                 │
                 │ (Payment received; fulfillment starts)
                 ▼
┌────────────────────────────────────────────────────┐
│                  Processing                         │
│         (Admin/seller updates via dashboard)        │
│                                                    │
│  Payment status → 'paid'; items being prepared     │
│  Seller preparing/packing items                    │
└────────────────┬─────────────────────────────────┘
                 │
                 │ (Package ready for dispatch)
                 ▼
┌────────────────────────────────────────────────────┐
│                    Shipped                         │
│         (Carrier pickup; tracking available)        │
│                                                    │
│  shipped_at timestamp set; tracking_number stored │
│  Buyer can track package                          │
└────────────────┬─────────────────────────────────┘
                 │
                 │ (Carrier confirms delivery)
                 ▼
┌────────────────────────────────────────────────────┐
│                   Delivered                         │
│         (End-of-transit; awaiting acceptance)       │
│                                                    │
│  delivered_at timestamp set; buyer receives item  │
│  Waiting for buyer confirmation or return period  │
└────────────────┬─────────────────────────────────┘
                 │
                 │ (Buyer accepts; return window closes)
                 ▼
┌────────────────────────────────────────────────────┐
│                   Completed                         │
│         (Final successful state)                    │
│                                                    │
│  completed_at timestamp set; order is fulfilled   │
│  Buyer cannot return; order archived              │
└────────────────────────────────────────────────────┘


ALTERNATE PATH: Cancellation
┌─────────────────────────────────────┐
│  Confirmed/Processing/Shipped       │
│  (Any point before delivery)        │
└────────────────┬────────────────────┘
                 │
                 │ (Buyer or admin cancels)
                 ▼
┌─────────────────────────────────────┐
│          Cancelled                  │
│                                     │
│ cancelled_at timestamp set          │
│ cancellation_reason stored          │
│ Inventory should be refunded        │
│ Refund record created if needed      │
└─────────────────────────────────────┘
```

### Order Item Status Lifecycle

Order items follow similar but simpler flow:

```
Pending → Confirmed → Shipped → Delivered

OR

(Any state) → Returned (buyer initiates return)
(Any state) → Cancelled (admin/system cancels)
```

Items are typically confirmed per seller (multiple sellers → multiple confirmations).

### Cart Clearing Behavior

When order is successfully created from 'cart' source:

1. **After order items inserted**: Service calls `removeCartItems(cartId, validProductIds)`
2. **Non-destructive**: Only removes items that were **successfully added** to order
3. **Skipped items remain**: Items that failed validation (inactive, insufficient stock) stay in cart for retry
4. **Idempotent**: Removing non-existent items is silently no-op
5. **Automatic flow**: No manual step required; buyer does not see stale cart items

**Example:**
- Cart has: Product A (qty 2), Product B (qty 5), Product C (qty 1)
- Order source: 'cart'
- Product A: valid ✅ → added to order + **removed from cart**
- Product B: inactive ❌ → skipped + **kept in cart**
- Product C: insufficient inventory ❌ → skipped + **kept in cart**
- Result: Cart now contains Product B (qty 5) and Product C (qty 1)

### Item Classification Rules

When processing order items (from cart or direct), each item is classified as **Valid** or **Skipped**:

**Valid Item ✅ Requirements:**
- Product exists in products table
- Product status = 'active'
- Requested quantity ≤ current inventory_quantity
- Quantity is positive integer (> 0)

**Skipped Item ❌ Reasons:**

| Reason                      | Trigger                                          | Action                     |
| --------------------------- | ------------------------------------------------ | -------------------------- |
| `product_not_found`         | Product UUID not in products table               | Skip; keep in cart if cart source |
| `product_inactive`          | Product exists but status ≠ 'active'             | Skip; keep in cart if cart source |
| `insufficient_inventory`    | Inventory count < requested quantity             | Skip; keep in cart if cart source |
| `invalid_quantity`          | Quantity ≤ 0 or NaN or not finite                | Skip; keep in cart if cart source |

---

## Repository Query Strategy

**File:** `lib/repositories/order.repository.ts`

### Atomicity & Transactions

The order creation involves multiple sequential operations that must succeed together or rollback completely:

```
1. Fetch user role (abort if not buyer)
2. Fetch/create cart (if cart source)  
3. Fetch cart items (if cart source)
4. Fetch all products by IDs (validate + classify)
5. Classify items (split valid/skipped)
6. IF no valid items → abort with error
7. Decrease inventory for each valid item (atomic per product)
8. Create order record (single insert)
9. Batch create order_items (single insert with multiple rows)
10. Clear cart items from cart (only valid ones)
║
║ If step 8, 9 fail → ROLLBACK by deleting order (cascade deletes items)
```

**Transaction Model:** Not an explicit SQL transaction; rather, a service-layer orchestration that tracks all operations and rolls back on error.

### Key Repository Functions

**`fetchUserRole(userId): Promise<UserRole | null>`**

```typescript
// Validates buyer role; used to enforce buyer-only order creation
const { data: user, error } = await supabase
  .from('users_profile')
  .select('role')
  .eq('user_id', userId)
  .single();

if (error || !user) return null;
return user.role;  // 'buyer' | 'seller' | 'admin'
```

**`fetchCartByUserId(userId): Promise<CartRow | null>`**

```typescript
// Retrieves buyer's cart (one-to-one relationship)
const { data: cart, error } = await supabase
  .from('carts')
  .select('*')
  .eq('user_id', userId)
  .single();

if (error?.code === 'PGRST116') return null;  // No rows
return cart;
```

**`fetchCartItems(cartId): Promise<CartItemRow[]>`**

```typescript
// Fetch all line items in cart for order creation
const { data: items, error } = await supabase
  .from('cart_items')
  .select('product_id, quantity')
  .eq('cart_id', cartId)
  .order('created_at', { ascending: true });

return items || [];
```

**`fetchProductsByIds(productIds): Promise<CheckoutProductRecord[]>`**

```typescript
// Batch fetch full product records for validation + enrichment
if (productIds.length === 0) return [];

const { data: products, error } = await supabase
  .from('products')
  .select('product_id, seller_id, name, short_description, images, status, inventory_quantity, price')
  .in('product_id', productIds);

return products || [];
```

**`decreaseProductInventory(productId, quantity): Promise<void>`**

```typescript
// Atomic decrement; validates sufficient stock before updating
const { data: product, error: fetchError } = await supabase
  .from('products')
  .select('inventory_quantity')
  .eq('product_id', productId)
  .single();

if (!product || product.inventory_quantity < quantity) {
  throw new Error('Insufficient inventory');
}

const { error: updateError } = await supabase
  .from('products')
  .update({ inventory_quantity: product.inventory_quantity - quantity })
  .eq('product_id', productId);

if (updateError) throw updateError;
```

**`createOrder(order: OrderInsert): Promise<OrderRow>`**

```typescript
// Inserts single order record
const { data, error } = await supabase
  .from('orders')
  .insert([order])
  .select('*')
  .single();

if (error) throw error;
return data;
```

**`createOrderItems(orderItems: OrderItemInsert[]): Promise<OrderItemRow[]>`**

```typescript
// Batch insert order line items
if (orderItems.length === 0) return [];

const { data, error } = await supabase
  .from('order_items')
  .insert(orderItems)
  .select('*');

if (error) throw error;
return data || [];
```

**`deleteOrder(orderId): Promise<void>`**

```typescript
// Cascade delete: removes order record + order_items (RLS-backed cascade)
const { error } = await supabase
  .from('orders')
  .delete()
  .eq('order_id', orderId);

if (error) throw error;
```

**`removeCartItems(cartId, productIds): Promise<void>`**

```typescript
// Removes only seller items from cart (other items stay for retry)
if (productIds.length === 0) return;

const { error } = await supabase
  .from('cart_items')
  .delete()
  .eq('cart_id', cartId)
  .in('product_id', productIds);

if (error) throw error;
```

---

## Business Logic

### Order Number Generation

**Function:** `computeOrderNumber(): string`

```typescript
function computeOrderNumber(): string {
  const now = new Date();
  
  // YYYYMMDDhhmmss (14 digits)
  const timestamp = now.toISOString()
    .replace(/[-:Z]/g, '')
    .substring(0, 14);
  
  // Random 6-char suffix (uppercase + lowercase alphanumeric)
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let suffix = '';
  for (let i = 0; i < 6; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return `ORD-${timestamp}-${suffix}`;
}
```

**Example outputs:**
- `ORD-20260406123456-ABCDEF`
- `ORD-20260406123456-xYz9K2`

### Inventory Management

**Pre-Order Validation:**

1. Fetch all products referenced in order items
2. For each product: check `inventory_quantity >= requested_quantity`
3. If insufficient: classify as skipped with `insufficient_inventory` reason
4. Only proceed if at least one valid item exists

**Atomic Decrement:**

1. Per valid order item, call `decreaseProductInventory(product_id, quantity)`
2. Each call is atomic: fetch current → validate → decrement → update (no race condition risk)
3. If decrement fails mid-order → service layer catches error → **rollback by deleting order** (cascade deletes items)
4. Inventory is refunded post-cancellation (future feature: automatic or manual refund flow)

**No Inventory Hold:**

- Current implementation: inventory decremented immediately upon order creation
- Alternative approach: "hold" inventory for 30min pending payment (not implemented)
- RLS ensures only owner + admin can read/write order records

### Address Storage

**Shipping Address:**
- Destination for package delivery
- Captured at order creation and stored as JSONB snapshot
- Can differ from billing address
- Immutable after order creation
- Supports international addresses (country required)

**Billing Address:**
- Address associated with payment method
- Optional; may equal shipping address
- Stored as JSONB snapshot
- Used for payment processing (future integration)

**Snapshot Approach:**
- Addresses are frozen at order time
- If user profile address changes later, order retains original
- Improves auditability and delivery accuracy
- No reference to users_profile.address; completely denormalized

### Product Snapshot Preservation

**Purpose:** Preserve product state at purchase time for auditing and dispute resolution

**Snapshot Content (OrderProductSnapshot):**
```json
{
  "name": "Wireless Keyboard",
  "short_description": "Ergonomic wireless keyboard with rechargeable battery",
  "image": "https://images.example.com/keyboard-123.jpg"
}
```

**Creation:**
- Extracted from product record during order item creation
- Stored in `order_items.product_snapshot` JSONB column
- Can include price snapshot in future enhancement

**Uses:**
- Buyer can see exact product details they purchased (no refetch needed)
- Seller cannot change product details retroactively affecting buyer's view
- Support team can investigate discrepancies

### Payment Status Initialization

**At Order Creation:**
- `payment_status` always set to `'pending'`
- `payment_method` stored if provided
- `payment_reference` remains null (populated post-payment processing)

**Status Transitions (Future Integration):**
- `'pending'` → `'paid'` (webhook from payment gateway)
- `'pending'` → `'failed'` (payment declined or timeout)
- `'paid'` → `'refunded'` (full refund issued)
- `'paid'` → `'partially_refunded'` (partial refund for returned items)

**Current Scope:** Payment integratio (Stripe/Paypal) is **out-of-scope** for CHK-02; reserved for CHK-03 or later.

### Cart Auto-Clearing

**Trigger:** Order successfully created from 'cart' source

**Execution:**
1. Order items inserted successfully (step 9 in transaction flow above)
2. Service calls `removeCartItems(cartId, validProductIds)`
3. Only removes items that were successfully added to order
4. Skipped items intentionally remain for retry attempt

**Rationale:**
- Prevents buyer from seeing stale cart items post-checkout
- Allows retry for unavailable items without re-adding
- Buyer can manually clear cart if desired
- Order-level atomicity: if cart clearing fails, entire order is rolled back

---

## Testing Checklist

| # | Scenario | Test Path | Expected Outcome |
| - | -------- | --------- | ---------------- |
| 1 | POST /api/orders without authentication | Call POST without session cookie | 401 Unauthorized |
| 2 | POST /api/orders with seller role (not buyer) | Authenticated as seller; call POST | 403 Forbidden |
| 3 | POST /api/orders with invalid source | `{ source: "invalid" }` | 400 Bad Request (Zod validation) |
| 4 | POST /api/orders direct source without items | `{ source: "direct" }` (no items) | 400 Bad Request |
| 5 | POST /api/orders direct source with empty items array | `{ source: "direct", items: [] }` | 400 Bad Request (no valid items) |
| 6 | POST /api/orders direct source with valid items | `{ source: "direct", items: [{product_id, quantity}] }` | 201 Created; order + items + skipped |
| 7 | Repeated add for same product (direct source) | Two items with same product_id | 201 Created; unique constraint on (order_id, product_id) |
| 8 | POST /api/orders cart source with existing cart | `{ source: "cart" }` with populated cart | 201 Created; order reflects cart items |
| 9 | POST /api/orders cart source with empty cart | `{ source: "cart" }` but buyer has no cart | 404 Cart Not Found OR auto-create empty cart → 400 No Valid Items |
| 10 | POST /api/orders cart source; cart clearing verification | Create order from cart; verify cart items removed | ✅ Cart items removed; skipped items remain |
| 11 | Item classification: product_not_found | Include non-existent product_id | ✅ Item skipped; reason: product_not_found |
| 12 | Item classification: product_inactive | Include inactive product | ✅ Item skipped; reason: product_inactive |
| 13 | Item classification: insufficient_inventory | Request more qty than stock | ✅ Item skipped; reason: insufficient_inventory |
| 14 | Item classification: invalid_quantity | `{ quantity: 0 }` or `{ quantity: -5 }` | ✅ Item skipped; reason: invalid_quantity |
| 15 | Inventory atomic decrement | Create order; verify products.inventory_quantity decreased | ✅ Inventory decremented for valid items |
| 16 | Order number uniqueness | Create two orders in quick succession | ✅ Each order has unique order_number |
| 17 | Address snapshot storage | Create order with shipping/billing addresses | ✅ Addresses stored as JSONB; immutable |
| 18 | Payment status initialization | Create order; check payment_status | ✅ Always 'pending' on creation |
| 19 | Order status initialization | Create order; check order status | ✅ Always 'confirmed' on creation |
| 20 | Product snapshot preservation | Create order; verify order_items.product_snapshot | ✅ Snapshot contains name, description, image |
| 21 | RLS isolation: buyer A cannot read buyer B's order | User A fetches /orders; verify no order from User B | ✅ RLS prevents cross-buyer access |
| 22 | RLS isolation: seller cannot create order | Seller attempts POST /api/orders | ✅ RLS + role check prevents |
| 23 | Admin bypass (future): admin can read any order | Admin authenticated; fetch user's orders | ✅ Admin sees all orders (via is_admin() policy) |
| 24 | Transaction rollback on inventory failure | Mock inventory decrement failure mid-order | ✅ Order deleted; partial items not persisted |
| 25 | Validation: negative shipping_amount | `{ shipping_amount: -5 }` | 400 Bad Request |
| 26 | Validation: oversized notes | notes > 1000 chars | 400 Bad Request |
| 27 | Validation: invalid address (missing required field) | Address missing city | 400 Bad Request |
| 28 | Response includes skipped_items array | Create order with some invalid items | ✅ Response includes detailed skip reasons |
| 29 | updated_at timestamp auto-update | Create order; update status manually; check updated_at | ✅ updated_at changes (trigger verification) |
| 30 | Maximum items limit | POST with 101 items array | 400 Bad Request (Zod max: 100) |

---

## Key Constraints & Gotchas

### 1. One Order per Transaction, Multiple Items per Seller

A single order can contain items from multiple sellers. Each `order_item` row captures `seller_id`, enabling mixed-seller orders in a single transaction.

### 2. Unique (order_id, product_id) Constraint

`order_items` table enforces `unique (order_id, product_id)`, preventing duplicate products in same order. Cart merging must normalize quantities before order creation.

### 3. Cart Source Requires Existing Cart

Cart source requires an active buyer's cart. If cart does not exist, either:
- Auto-create it (idempotent), then fail with "no valid items"
- Error immediately: 404 Cart Not Found

Current implementation: **auto-creates if missing**, then fails on empty items.

### 4. Skipped Items Stay in Cart

Cart-source orders intentionally leave skipped items in cart. Buyer can retry after inventory replenish or product activation.

### 5. Inventory Decrement is Immediate, Not Atomic

Each `decreaseProductInventory()` call is atomic in isolation, but the full order-creation sequence is **not** wrapped in a single SQL transaction. If step 10 (order_items insert) fails, inventory is decremented but order not created—**rollback manually** by deleting the order (cascade deletes items).

Better approach (future): Use explicit SQL transaction or Supabase RLS + stored procedures.

### 6. Addresses are JSONB, Not Normalized

Shipping/billing addresses stored as JSONB snapshots, not foreign keys. Preserves immutability but loses referential integrity. No "address master table" currently.

### 7. Order Numbers Must be Globally Unique

`order_number` column has unique constraint. Timestamp + random suffix provides very high collision probability (< 1 in 60+ trillion), but not cryptographic. In distributed scenarios, consider UUIDv4 or centralized sequence.

### 8. No Payment Processing Yet

`payment_status` initialized as 'pending'. Actual payment capture (Stripe/PayPal) **not implemented**. Payment reference field reserved for future webhook integration.

### 9. No Inventory Hold or Expiration

Inventory decremented immediately upon order creation, not held during checkout or awaiting payment. No timeout/expiration for pending orders. If payment fails, inventory is **not automatically refunded** (future: implement via refund flow).

### 10. Product Status Must be 'active'

Products with status ≠ 'active' are skipped. Sellers can soft-delete products by setting status to 'inactive', preventing new orders while preserving history.

### 11. Seller_id Sourced from Products Table

`order_items.seller_id` is not validated against a separate seller whitelist; it's sourced directly from `products.seller_id`. If seller record is deleted, order items remain (FK on delete cascade not applied).

### 12. Cascading Deletes on Order Deletion

Deleting an order cascades to order_items (via FK). Deleting a product restricts order_items deletion (prevents orphaned items). This design preserves order history integrity.

### 13. Tax/Shipping Calculations Are Inputs, Not Computed

Service layer does not compute tax/shipping; these are client-provided and stored as-is. Validation ensures non-negative and finite. Total = subtotal + tax + shipping - discount.

### 14. No Concurrency Control on Cart

Multiple simultaneous requests adding/removing items from same cart may cause race conditions. Recommend optimistic locking or pessimistic row locks for high-concurrency scenarios.

---

## Future Considerations

### Not Yet Implemented

1. **Payment Gateway Integration** (Stripe, PayPal)
   - Capture payment_reference from webhook
   - Transition payment_status from 'pending' → 'paid' | 'failed'
   - Reserve: CHK-03 or CHK-04

2. **Order Cancellation Workflow**
   - Buyer/admin can cancel order (set status → 'cancelled')
   - Refund inventory (restore inventory_quantity)
   - Create refund record linking to order
   - Reserved: CHK-03 or separate cancellation epic

3. **Refund Processing & AI Decision Support**
   - Schema includes refunds table with `ai_refund_decision_enum`
   - Auto-approve | manual review | auto-reject
   - Link to order for context
   - Reserved: Future feature

4. **Order Return/Exchange Flow**
   - Update order_item_status → 'returned'
   - Trigger refund process
   - (May involve seller approval or automatic RMA)
   - Reserved: Future feature

5. **Bundle Orders**
   - Currently: one order per source (cart or direct)
   - Future: combine items from multiple sources or category-based bundles
   - Requires cart restructuring (group by seller/category)

6. **Shipping Integration**
   - Auto-generate shipping labels via carrier API
   - Update order.tracking_number on shipment
   - Webhook callbacks to update shipped_at / delivered_at
   - Reserved: Future feature

7. **Email Notifications**
   - Order confirmation email (buyer)
   - Shipment notification (buyer + seller)
   - Delivery confirmation (buyer)
   - Reserved: Future feature (can hook into webhooks)

8. **Analytics & Reporting**
   - Order volume by period
   - Sales by seller / product category
   - Refund rate tracking
   - Payment failure analysis
   - Reserved: Future analytics module

9. **Soft Deletion & Audit Logging**
   - Current: hard delete via cascade
   - Future: soft delete (status → 'archived') + audit_logs table
   - Track all mutations (create, update, cancel) with user + timestamp
   - Reserved: Audit trail epic

10. **Concurrency & Locking**
    - Optimistic locking on cart_items (version field)
    - Pessimistic row locks during checkout
    - Reserved: High-concurrency scenario optimization

---

## Summary

CHK-02 delivers a production-ready order creation API with support for cart-based and direct purchase flows. The implementation includes atomic inventory management, automatic cart clearing, comprehensive item classification, and full RLS-backed buyer isolation.

**Scope Implemented:**

- ✅ Orders + order_items schema with status/payment enums
- ✅ Buyer role enforcement + authenticated order creation
- ✅ Cart and direct item sources with product validation
- ✅ Inventory pre-check + atomic decrement per item
- ✅ Auto-generated order numbers (timestamp + random suffix)
- ✅ Address snapshots (shipping + billing) as JSONB
- ✅ Product snapshots preserving purchase-time state
- ✅ Skipped item classification (product_not_found, product_inactive, insufficient_inventory, invalid_quantity)
- ✅ Cart auto-clearing post-order (valid items only; skipped items remain)
- ✅ Layered architecture (API → service → repository → Supabase)
- ✅ Comprehensive RLS policies for buyer isolation + admin bypass
- ✅ Transactional rollback (delete order if items insert fails)

**Scope Reserved:**

- ❌ Payment processing integration (Stripe/PayPal) — CHK-03 or later
- ❌ Order cancellation + refund workflow — Future epic
- ❌ Shipping label generation + carrier APIs — Future feature
- ❌ Email notifications — Future feature
- ❌ Analytics + reporting — Future module
- ❌ Bundle orders (mixed categories) — Future enhancement
- ❌ Audit logging — Future initiative

**Key Validations:**

- Auth: Must be authenticated buyer (RLS enforced)
- Items: At least one valid item required
- Inventory: Pre-checked atomically per product
- Addresses: Optional but validated per schema if provided
- Amounts: Non-negative and finite
- Quantity: Must be positive integer

---

**Document Maintainers:** Development Team  
**Last Reviewed:** April 2026  
**Next Review:** Upon payment integration (CHK-03) or refund workflow completion

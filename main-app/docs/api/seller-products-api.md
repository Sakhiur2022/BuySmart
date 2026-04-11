# Seller Products REST API Documentation

## Overview

The Seller Products API allows authenticated sellers to manage their product listings with full CRUD operations, filtering, sorting, and pagination.

**Base URL**: `/api/seller/products`  
**Authentication**: Required (Seller role)  
**Content-Type**: `application/json`

---

## Authentication

All endpoints require:
1. User to be authenticated via Supabase Auth
2. User's `users_profile` record to have `role = 'seller'`
3. Authentication is handled via HTTP-only cookies (automatic with same-origin requests)

### Error Responses

- **401 Unauthorized**: Not authenticated
- **403 Forbidden**: Not a seller

---

## Endpoints

### 1. GET /api/seller/products - List Products

List all products for the authenticated seller with optional filtering, sorting, and pagination.

#### Query Parameters

| Parameter | Type | Optional | Default | Constraints | Description |
|-----------|------|----------|---------|-------------|-------------|
| `status` | enum | ✓ | - | draft, active, inactive, out_of_stock | Filter by product status |
| `category_id` | number | ✓ | - | >= 0 | Filter by category ID |
| `sortBy` | enum | ✓ | created_at | name, price, created_at | Sort field |
| `sortOrder` | enum | ✓ | desc | asc, desc | Sort direction |
| `page` | number | ✓ | 1 | >= 1 | Page number for pagination |
| `pageSize` | number | ✓ | 20 | 1-100 | Items per page |

#### Example Request

```bash
GET /api/seller/products?status=active&sortBy=price&sortOrder=desc&page=1&pageSize=20
```

#### Success Response (200 OK)

```json
{
  "products": [
    {
      "id": "prod_abc123",
      "name": "Wireless Headphones",
      "price": 79.99,
      "image": "https://example.com/image.jpg",
      "description": "High-quality wireless headphones"
    },
    {
      "id": "prod_def456",
      "name": "USB-C Cable",
      "price": 12.99,
      "image": "https://example.com/cable.jpg",
      "description": "Travel-friendly short cable"
    }
  ],
  "pagination": {
    "totalCount": 42,
    "page": 1,
    "pageSize": 20,
    "totalPages": 3
  }
}
```

#### Error Responses

| Status | Response |
|--------|----------|
| 400 | `{ "error": "Validation failed", "issues": {...} }` |
| 401 | `{ "error": "Unauthorized: Not authenticated" }` |
| 403 | `{ "error": "Forbidden: Only sellers can access this endpoint" }` |
| 500 | `{ "error": "Failed to fetch products" }` |

---

### 2. POST /api/seller/products - Create Product

Create a new product for the authenticated seller.

#### Request Body

| Field | Type | Optional | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `name` | string | ✗ | 1-255 chars | Product name |
| `price` | number | ✗ | > 0 | Product price in decimal |
| `inventory_quantity` | number | ✗ | >= 0, integer | Stock quantity |
| `status` | enum | ✓ | draft, active, inactive, out_of_stock | Default: active |
| `short_description` | string | ✓ | <= 500 chars | Brief description |
| `description` | string | ✓ | Unlimited | Detailed description |
| `category_id` | number | ✓ | >= 0, integer | Parent category |

#### Example Request

```bash
POST /api/seller/products
Content-Type: application/json

{
  "name": "Premium Wireless Speaker",
  "price": 149.99,
  "inventory_quantity": 50,
  "status": "active",
  "short_description": "Portable Bluetooth speaker",
  "description": "Premium Bluetooth speaker with 20-hour battery life and waterproof design",
  "category_id": 15
}
```

#### Success Response (201 Created)

```json
{
  "product_id": "prod_xyz789",
  "name": "Premium Wireless Speaker",
  "price": 149.99,
  "inventory_quantity": 50,
  "status": "active",
  "short_description": "Portable Bluetooth speaker",
  "description": "Premium Bluetooth speaker with 20-hour battery life and waterproof design",
  "images": [],
  "category_id": 15,
  "created_at": "2026-03-22T10:30:00Z",
  "updated_at": "2026-03-22T10:30:00Z"
}
```

#### Error Responses

| Status | Response |
|--------|----------|
| 400 | `{ "error": "Validation failed", "issues": {...} }` |
| 400 | `{ "error": "Invalid JSON payload" }` |
| 401 | `{ "error": "Unauthorized: Not authenticated" }` |
| 403 | `{ "error": "Forbidden: Only sellers can access this endpoint" }` |
| 500 | `{ "error": "Failed to create product" }` |

---

### 3. PATCH /api/seller/products?id=<product_id> - Update Product

Update an existing product owned by the authenticated seller.

#### Query Parameters

| Parameter | Type | Optional | Description |
|-----------|------|----------|-------------|
| `id` | string | ✗ | Product ID to update |

#### Request Body

Same as POST but all fields are optional. Only include fields to update.

#### Example Request

```bash
PATCH /api/seller/products?id=prod_xyz789
Content-Type: application/json

{
  "price": 139.99,
  "inventory_quantity": 45,
  "status": "out_of_stock"
}
```

#### Success Response (200 OK)

```json
{
  "product_id": "prod_xyz789",
  "name": "Premium Wireless Speaker",
  "price": 139.99,
  "inventory_quantity": 45,
  "status": "out_of_stock",
  "short_description": "Portable Bluetooth speaker",
  "description": "Premium Bluetooth speaker with 20-hour battery life and waterproof design",
  "images": [],
  "category_id": 15,
  "created_at": "2026-03-22T10:30:00Z",
  "updated_at": "2026-03-22T10:35:00Z"
}
```

#### Error Responses

| Status | Response |
|--------|----------|
| 400 | `{ "error": "Missing required query parameter: id" }` |
| 400 | `{ "error": "Invalid JSON payload" }` |
| 400 | `{ "error": "Validation failed", "issues": {...} }` |
| 401 | `{ "error": "Unauthorized: Not authenticated" }` |
| 403 | `{ "error": "Forbidden: Only sellers can access this endpoint" }` |
| 404 | `{ "error": "Product not found or does not belong to seller" }` |
| 500 | `{ "error": "Failed to update product" }` |

---

### 4. DELETE /api/seller/products?id=<product_id> - Delete Product

Delete a product owned by the authenticated seller.

#### Query Parameters

| Parameter | Type | Optional | Description |
|-----------|------|----------|-------------|
| `id` | string | ✗ | Product ID to delete |

#### Example Request

```bash
DELETE /api/seller/products?id=prod_xyz789
```

#### Success Response (204 No Content)

Empty response body.

#### Error Responses

| Status | Response |
|--------|----------|
| 400 | `{ "error": "Missing required query parameter: id" }` |
| 401 | `{ "error": "Unauthorized: Not authenticated" }` |
| 403 | `{ "error": "Forbidden: Only sellers can access this endpoint" }` |
| 404 | `{ "error": "Product not found or does not belong to seller" }` |
| 500 | `{ "error": "Failed to delete product" }` |

---

## Data Types

### Product Object (List Response)

```json
{
  "id": "string (product_id)",
  "name": "string",
  "price": "number (decimal)",
  "image": "string (URL) | null",
  "description": "string | null"
}
```

### Full Product Object (Create/Update Response)

```json
{
  "product_id": "string",
  "name": "string",
  "price": "number",
  "inventory_quantity": "integer",
  "status": "draft|active|inactive|out_of_stock",
  "short_description": "string | null",
  "description": "string | null",
  "images": "array of URLs | null",
  "category_id": "integer | null",
  "created_at": "ISO 8601 timestamp",
  "updated_at": "ISO 8601 timestamp"
}
```

### Pagination Object

```json
{
  "totalCount": "integer (total products matching query)",
  "page": "integer (current page)",
  "pageSize": "integer (items per page)",
  "totalPages": "integer (ceil(totalCount / pageSize))"
}
```

---

## Status/Enum Values

### Product Status

- `draft` - Product saved but not published
- `active` - Product is published and available for sale
- `inactive` - Product is published but not available for sale
- `out_of_stock` - Product is out of stock

### Sort Fields

- `name` - Product name (alphabetical)
- `price` - Product price (numeric)
- `created_at` - Creation timestamp

### Sort Orders

- `asc` - Ascending order (A→Z, low→high, old→new)
- `desc` - Descending order (Z→A, high→low, new→old)

---

## Rate Limiting

Currently no rate limiting is enforced. Future versions may implement rate limiting.

---

## Error Handling

All errors follow a consistent format:

```json
{
  "error": "Human-readable error message",
  "issues": {}
}
```

Validation errors include detailed `issues` object with field names and their validation problems.

---

## Best Practices

1. **Pagination**: Always use pagination for list endpoints to improve performance
2. **Filtering**: Use status and category filters to reduce data transfer
3. **Sorting**: Default sort is `created_at` descending; customize as needed
4. **Error Handling**: Always check HTTP status code and handle 4xx/5xx appropriately
5. **Rate Limiting**: Consider implementing client-side backoff for 429 responses (future)

---

## Examples

### Create, Read, Update, Delete Workflow

```bash
# 1. Create a product
PRODUCT_DATA=$(curl -X POST /api/seller/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Product",
    "price": 99.99,
    "inventory_quantity": 100
  }')

PRODUCT_ID=$(echo $PRODUCT_DATA | jq -r '.product_id')

# 2. Read all products
curl -X GET /api/seller/products?status=active&page=1

# 3. Update the product
curl -X PATCH "/api/seller/products?id=$PRODUCT_ID" \
  -H "Content-Type: application/json" \
  -d '{"price": 89.99}'

# 4. Delete the product
curl -X DELETE "/api/seller/products?id=$PRODUCT_ID"
```

### Advanced Filtering & Sorting

```bash
# Active products in category 5, sorted by price (lowest first), 10 items per page
curl -X GET /api/seller/products?status=active&category_id=5&sortBy=price&sortOrder=asc&pageSize=10&page=1
```

---

## Implementation Details

### File Location
- [app/api/seller/products/route.ts](../../app/api/seller/products/route.ts)

### Key Features
- ✅ Full CRUD operations (Create, Read, Update, Delete)
- ✅ Filtering (status, category)
- ✅ Sorting (name, price, created_at)
- ✅ Pagination (offset-based, configurable page size 1-100)
- ✅ Authentication & Authorization (seller-only access, RLS policies)
- ✅ Input validation (Zod schemas)
- ✅ Comprehensive error handling
- ✅ JSDoc comments for all handlers

### Database Integration
- Uses Supabase Postgres client (`createClient()`)
- Leverages existing `products` table
- RLS policy `products_owner_write` ensures sellers can only modify their own products
- Request filtering by `seller_id` ensures seller-specific data access

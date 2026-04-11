# Seller Products API Test Guide

## Base URL
```
http://localhost:3000/api/seller/products
```

## Authentication
All requests require a valid authentication token (sent automatically via cookies for same-origin requests). User must have `role='seller'` in `users_profile` table.

## Test Scenarios

### 1. Authentication & Access Control

#### Test 1.1: Unauthenticated Request (should return 401)
```bash
curl -X GET http://localhost:3000/api/seller/products
```
Expected: 401 Unauthorized

#### Test 1.2: Non-Seller User Request (should return 403)
Use a logged-in buyer account and make the same request.
Expected: 403 Forbidden

#### Test 1.3: Seller Access (should return 200)
Use a logged-in seller account and make the same request.
Expected: 200 with product list

---

### 2. GET /api/seller/products - List, Filter, Sort, Paginate

#### Test 2.1: List All Products (Basic)
```bash
curl -X GET http://localhost:3000/api/seller/products \
  -H "Content-Type: application/json"
```
Expected: 200 with array of products (formatted with id, name, price, image, description) and pagination metadata

#### Test 2.2: Filter by Status (Active Products Only)
```bash
curl -X GET "http://localhost:3000/api/seller/products?status=active" \
  -H "Content-Type: application/json"
```
Expected: 200 with only active products

#### Test 2.3: Filter by Category
```bash
curl -X GET "http://localhost:3000/api/seller/products?category_id=5" \
  -H "Content-Type: application/json"
```
Expected: 200 with products in category 5

#### Test 2.4: Sort by Price (Descending)
```bash
curl -X GET "http://localhost:3000/api/seller/products?sortBy=price&sortOrder=desc" \
  -H "Content-Type: application/json"
```
Expected: 200 with products sorted by price descending

#### Test 2.5: Sort by Creation Date (Ascending)
```bash
curl -X GET "http://localhost:3000/api/seller/products?sortBy=created_at&sortOrder=asc" \
  -H "Content-Type: application/json"
```
Expected: 200 with oldest products first

#### Test 2.6: Pagination (Page 2, 10 Items per Page)
```bash
curl -X GET "http://localhost:3000/api/seller/products?page=2&pageSize=10" \
  -H "Content-Type: application/json"
```
Expected: 200 with products from page 2 (offset 10-20)

#### Test 2.7: Combine Filters, Sort, and Pagination
```bash
curl -X GET "http://localhost:3000/api/seller/products?status=active&category_id=5&sortBy=price&sortOrder=asc&page=1&pageSize=20" \
  -H "Content-Type: application/json"
```
Expected: 200 with filtered, sorted, and paginated results

#### Test 2.8: Invalid Status (should return 400)
```bash
curl -X GET "http://localhost:3000/api/seller/products?status=invalid_status" \
  -H "Content-Type: application/json"
```
Expected: 400 with validation error details

#### Test 2.9: Invalid Page Size > 100 (should return 400)
```bash
curl -X GET "http://localhost:3000/api/seller/products?pageSize=150" \
  -H "Content-Type: application/json"
```
Expected: 400 with validation error

#### Test 2.10: Invalid Sort Field (should return 400)
```bash
curl -X GET "http://localhost:3000/api/seller/products?sortBy=invalid_field" \
  -H "Content-Type: application/json"
```
Expected: 400 with validation error

---

### 3. POST /api/seller/products - Create Product

#### Test 3.1: Create Product with Required Fields (Valid)
```bash
curl -X POST http://localhost:3000/api/seller/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Wireless Headphones",
    "price": 79.99,
    "inventory_quantity": 50
  }'
```
Expected: 201 with full product object

#### Test 3.2: Create Product with All Optional Fields
```bash
curl -X POST http://localhost:3000/api/seller/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Premium Bluetooth Speaker",
    "price": 149.99,
    "inventory_quantity": 30,
    "status": "active",
    "short_description": "High-quality audio",
    "description": "Premium Bluetooth speaker with 20-hour battery life",
    "category_id": 12
  }'
```
Expected: 201 with full product object

#### Test 3.3: Create with Missing Required Field (should return 400)
```bash
curl -X POST http://localhost:3000/api/seller/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Incomplete Product",
    "price": 49.99
  }'
```
Expected: 400 with validation error (missing inventory_quantity)

#### Test 3.4: Create with Negative Price (should return 400)
```bash
curl -X POST http://localhost:3000/api/seller/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Bad Price Product",
    "price": -10.00,
    "inventory_quantity": 50
  }'
```
Expected: 400 with validation error

#### Test 3.5: Create with Negative Inventory (should return 400)
```bash
curl -X POST http://localhost:3000/api/seller/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Bad Inventory Product",
    "price": 50.00,
    "inventory_quantity": -5
  }'
```
Expected: 400 with validation error

#### Test 3.6: Create with Invalid Status (should return 400)
```bash
curl -X POST http://localhost:3000/api/seller/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Invalid Status Product",
    "price": 50.00,
    "inventory_quantity": 50,
    "status": "invalid_status"
  }'
```
Expected: 400 with validation error

#### Test 3.7: Invalid JSON Payload (should return 400)
```bash
curl -X POST http://localhost:3000/api/seller/products \
  -H "Content-Type: application/json" \
  -d '{invalid json'
```
Expected: 400 with "Invalid JSON payload"

---

### 4. PATCH /api/seller/products?id=<product_id> - Update Product

#### Test 4.1: Update Own Product (Valid)
```bash
# First, capture a product_id from a GET request
PRODUCT_ID="prod_abc123"

curl -X PATCH "http://localhost:3000/api/seller/products?id=${PRODUCT_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "price": 89.99,
    "inventory_quantity": 45
  }'
```
Expected: 200 with updated product object

#### Test 4.2: Update Only Name
```bash
curl -X PATCH "http://localhost:3000/api/seller/products?id=${PRODUCT_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Product Name"
  }'
```
Expected: 200 with updated product

#### Test 4.3: Update to Different Status
```bash
curl -X PATCH "http://localhost:3000/api/seller/products?id=${PRODUCT_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "out_of_stock"
  }'
```
Expected: 200 with updated product

#### Test 4.4: Update Non-Existent Product (should return 404)
```bash
curl -X PATCH "http://localhost:3000/api/seller/products?id=nonexistent_id" \
  -H "Content-Type: application/json" \
  -d '{
    "price": 99.99
  }'
```
Expected: 404 with "Product not found"

#### Test 4.5: Update Another Seller's Product (should return 404)
Logged in as Seller A, try to update Seller B's product ID
Expected: 404 with "Product not found or does not belong to seller"

#### Test 4.6: Missing Product ID Query Param (should return 400)
```bash
curl -X PATCH "http://localhost:3000/api/seller/products" \
  -H "Content-Type: application/json" \
  -d '{
    "price": 99.99
  }'
```
Expected: 400 with "Missing required query parameter: id"

#### Test 4.7: Update with Invalid Price (should return 400)
```bash
curl -X PATCH "http://localhost:3000/api/seller/products?id=${PRODUCT_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "price": -50.00
  }'
```
Expected: 400 with validation error

#### Test 4.8: Update with Invalid Inventory (should return 400)
```bash
curl -X PATCH "http://localhost:3000/api/seller/products?id=${PRODUCT_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "inventory_quantity": -10
  }'
```
Expected: 400 with validation error

---

### 5. DELETE /api/seller/products?id=<product_id> - Delete Product

#### Test 5.1: Delete Own Product (Valid)
```bash
PRODUCT_ID="prod_abc123"

curl -X DELETE "http://localhost:3000/api/seller/products?id=${PRODUCT_ID}" \
  -H "Content-Type: application/json"
```
Expected: 204 (No Content)

#### Test 5.2: Verify Product is Deleted
```bash
curl -X GET "http://localhost:3000/api/seller/products" | grep ${PRODUCT_ID}
```
Expected: Product not in list

#### Test 5.3: Delete Non-Existent Product (should return 404)
```bash
curl -X DELETE "http://localhost:3000/api/seller/products?id=nonexistent_id" \
  -H "Content-Type: application/json"
```
Expected: 404 with "Product not found"

#### Test 5.4: Delete Another Seller's Product (should return 404)
Logged in as Seller A, try to delete Seller B's product ID
Expected: 404 with "Product not found or does not belong to seller"

#### Test 5.5: Missing Product ID Query Param (should return 400)
```bash
curl -X DELETE "http://localhost:3000/api/seller/products" \
  -H "Content-Type: application/json"
```
Expected: 400 with "Missing required query parameter: id"

---

## Test Execution Checklist

### Authentication Tests
- [ ] Test 1.1: Unauthenticated (401)
- [ ] Test 1.2: Non-seller (403)
- [ ] Test 1.3: Seller access (200)

### GET Endpoint Tests
- [ ] Test 2.1: List all products
- [ ] Test 2.2: Filter by status
- [ ] Test 2.3: Filter by category
- [ ] Test 2.4: Sort by price
- [ ] Test 2.5: Sort by created_at
- [ ] Test 2.6: Pagination
- [ ] Test 2.7: Combined filters/sort/pagination
- [ ] Test 2.8: Invalid status (400)
- [ ] Test 2.9: Invalid page size (400)
- [ ] Test 2.10: Invalid sort field (400)

### POST Endpoint Tests
- [ ] Test 3.1: Valid required fields (201)
- [ ] Test 3.2: Valid with optional fields (201)
- [ ] Test 3.3: Missing required field (400)
- [ ] Test 3.4: Negative price (400)
- [ ] Test 3.5: Negative inventory (400)
- [ ] Test 3.6: Invalid status (400)
- [ ] Test 3.7: Invalid JSON (400)

### PATCH Endpoint Tests
- [ ] Test 4.1: Update own product (200)
- [ ] Test 4.2: Update single field (200)
- [ ] Test 4.3: Update status (200)
- [ ] Test 4.4: Non-existent product (404)
- [ ] Test 4.5: Another seller's product (404)
- [ ] Test 4.6: Missing product ID (400)
- [ ] Test 4.7: Invalid price (400)
- [ ] Test 4.8: Invalid inventory (400)

### DELETE Endpoint Tests
- [ ] Test 5.1: Delete own product (204)
- [ ] Test 5.2: Verify deletion
- [ ] Test 5.3: Non-existent product (404)
- [ ] Test 5.4: Another seller's product (404)
- [ ] Test 5.5: Missing product ID (400)

---

## Notes

1. **Pagination Metadata**: Use `pagination.totalCount`, `pagination.page`, `pagination.pageSize`, `pagination.totalPages`
2. **Response Fields**: GET returns `id, name, price, image, description`. POST/PATCH return full product object.
3. **Images Field**: Array of image URLs; `image` in formatted response is the first element
4. **Seller Verification**: RLS policies + query filters ensure sellers can only access their own products
5. **Status Enums**: draft, active, inactive, out_of_stock
6. **Sort Fields**: name, price, created_at (default: created_at)
7. **Sort Orders**: asc, desc (default: desc)

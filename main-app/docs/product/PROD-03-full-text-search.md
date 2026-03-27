# PROD-03: Buyer Product Full-Text Search

**Document Version:** 1.0  
**Status:** Implemented  
**Sprint:** Sprint-2  
**Last Updated:** March 2026

---

## Overview

PROD-03 implements buyer-facing product search using **Supabase + PostgreSQL Full-Text Search (FTS)**. The feature enables:

- **Buyers** to search products by keyword from the buyer browsing experience
- **Database-level filtering** (name, descriptions, and category text) instead of client-side filtering
- **Composable filtering** with price range, category, and pagination
- **Shareable URL state** via query parameters for deep-linking and bookmarking
- **Layered architecture compliance**: page -> action -> controller -> service -> repository -> Supabase

The implementation is intentionally **RSC-first** and avoids fetch-in-effect product loading for the main listing flow.

---

## User Stories Covered

| Story ID | Title                                                           | Status         |
| -------- | --------------------------------------------------------------- | -------------- |
| US-XX    | Buyer can search products by keyword                            | ✅ Implemented |
| US-XX    | Buyer search supports URL params and shareable links            | ✅ Implemented |
| US-XX    | Buyer can combine search with category and price filters        | ✅ Implemented |
| US-XX    | Empty search falls back to default product listing              | ✅ Implemented |
| US-XX    | Buyer sees loading and no-results UI during search interactions | ✅ Implemented |

---

## Database Schema

### products Table (Search Additions)

The full-text implementation extends the existing `products` table with a PostgreSQL `tsvector` column.

```sql
alter table public.products
	add column if not exists search_vector tsvector;
```

**Column Details:**

| Column          | Type       | Constraint | Description                                                           |
| --------------- | ---------- | ---------- | --------------------------------------------------------------------- |
| `search_vector` | `tsvector` | nullable   | Weighted text-search vector used by `.textSearch()` in Supabase query |

### Search Vector Function

```sql
create or replace function public.compute_product_search_vector(
	p_name text,
	p_short_description text,
	p_description text,
	p_category_name text
) returns tsvector
language sql
immutable
as $$
	select
		setweight(to_tsvector('english', unaccent(coalesce(p_name, ''))), 'A') ||
		setweight(to_tsvector('english', unaccent(coalesce(p_category_name, ''))), 'A') ||
		setweight(to_tsvector('english', unaccent(coalesce(p_short_description, ''))), 'B') ||
		setweight(to_tsvector('english', unaccent(coalesce(p_description, ''))), 'C');
$$;
```

**Weighting Strategy:**

- `A`: product name + category name (highest relevance)
- `B`: short description
- `C`: full description

### Trigger-Based Maintenance

Two triggers keep vectors synchronized automatically:

1. `trg_products_set_search_vector` on product insert/update
2. `trg_categories_refresh_products_search_vector` on category name update

### Indexing

```sql
create index if not exists idx_products_search_vector
	on public.products
	using gin (search_vector);
```

GIN index ensures scalable FTS performance for buyer queries.

### RLS Policies

This feature uses existing `products` and `categories` read policies. No new RLS policies were required. Search respects existing visibility constraints because queries run against the same tables and authenticated context.

### Migration File

**File:** `lib/supabase/db/text-search.sql`

This script:

1. Enables `unaccent` extension
2. Adds `search_vector` column
3. Creates `compute_product_search_vector(...)`
4. Creates product update trigger function
5. Creates category rename refresh trigger function
6. Backfills vectors for existing records
7. Creates GIN index

---

## TypeScript Models

### Product Search Model

**File:** `lib/models/product.model.ts`

```typescript
export interface BuyerProductListFilters {
  page: number;
  pageSize: number;
  priceMin?: number;
  priceMax?: number;
  categoryId?: number;
  query?: string;
}

export interface BuyerProductQueryParams {
  page?: number;
  pageSize?: number;
  priceMin?: number;
  priceMax?: number;
  categoryId?: number;
  q?: string;
  search?: string;
}
```

**Key Type Notes:**

- `categoryId` remains numeric (`number`) and maps to `products.category_id` (`bigint`)
- Both `q` (primary) and `search` (legacy compatibility) are accepted at service boundary
- Pagination is strongly typed in `BuyerProductPagination` and returned with each listing response

---

## Architecture & Data Flow

### Layer Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  HTTP Request with URL search params                        │
│  (/buyer or /buyer/products?q=...&categoryId=...)          │
└─────────────────────────────────┬───────────────────────────┘
																	│
								┌─────────────────▼──────────────────┐
								│  Next.js Server Page (RSC)         │
								│  - app/(buyer)/buyer/page.tsx      │
								│  - app/(buyer)/buyer/products/page │
								└─────────────────┬──────────────────┘
																	│
								┌─────────────────▼──────────────────────┐
								│  Server Action                          │
								│  lib/actions/buyer-products.actions.ts │
								│  - 'use server' boundary               │
								└─────────────────┬──────────────────────┘
																	│
								┌─────────────────▼──────────────────────┐
								│  Controller                             │
								│  lib/controllers/product.controller.ts  │
								│  - Thin orchestration layer             │
								└─────────────────┬──────────────────────┘
																	│
								┌─────────────────▼──────────────────────┐
								│  Service Layer                          │
								│  lib/services/product.service.ts        │
								│  - Param normalization                  │
								│  - q/search compatibility               │
								│  - price range validation               │
								└─────────────────┬──────────────────────┘
																	│
								┌─────────────────▼──────────────────────┐
								│  Repository Layer                       │
								│  lib/repositories/product.repository.ts │
								│  - Supabase query construction          │
								│  - .textSearch('search_vector', ...)    │
								│  - Filter + pagination composition      │
								└─────────────────┬──────────────────────┘
																	│
								┌─────────────────▼──────────────────────┐
								│  Supabase PostgreSQL                    │
								│  products.search_vector (GIN indexed)   │
								│  categories join via trigger refresh    │
								└─────────────────────────────────────────┘
```

**Why Layered?**

- Keeps all Supabase querying in repository layer
- Makes buyer page/server action code deterministic and testable
- Isolates validation/normalization logic in service layer
- Preserves architecture consistency with existing category and other domain modules

---

## File Structure Map

### New Files Created

```
lib/supabase/db/
	└─ text-search.sql
			 ├─ Adds search_vector tsvector column
			 ├─ Creates compute_product_search_vector(...)
			 ├─ Creates product/category trigger functions
			 ├─ Backfills existing rows
			 └─ Creates GIN index idx_products_search_vector

lib/models/
	└─ product.model.ts
			 ├─ BuyerProductListItem
			 ├─ BuyerProductPagination
			 ├─ BuyerProductListFilters
			 ├─ BuyerProductListResult
			 └─ BuyerProductQueryParams

lib/repositories/
	└─ product.repository.ts
			 ├─ findBuyerProducts(filters)
			 ├─ status filter (active)
			 ├─ category/price filters
			 ├─ textSearch(search_vector, query)
			 └─ pagination + sorting

lib/services/
	└─ product.service.ts
			 ├─ normalizeQuery(q || search)
			 ├─ numeric bounds/defaults
			 ├─ MAX_PAGE_SIZE guard
			 └─ price range validation

lib/controllers/
	└─ product.controller.ts
			 └─ getBuyerProducts(params)

lib/actions/
	└─ buyer-products.actions.ts
			 └─ getBuyerProductsAction(params)

components/products/
	└─ product-search-input.tsx
			 ├─ URL-driven search input
			 ├─ debounce (350ms default)
			 ├─ q/search normalization
			 └─ page reset to page=1 on query changes
```

### Modified Files

| File                                           | Changes                                                                                    | Reason                                               |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| `app/(buyer)/buyer/products/page.tsx`          | RSC data loading through action/controller chain; uses searchParams (`q/search`, filters)  | Server-rendered listing with layered architecture    |
| `app/(buyer)/buyer/page.tsx`                   | Buyer landing integrates same listing/search chain and seller buyer-mode guard behavior    | Keep buyer browse in one route with URL search state |
| `components/products/product-listing-page.tsx` | URL-param-driven pagination/filter updates, transition loading state, no-results messaging | Remove client-side product fetch loop                |

---

## Buyer Search Behavior

### URL Parameter Contract

| Param        | Type   | Description                                              |
| ------------ | ------ | -------------------------------------------------------- |
| `q`          | string | Primary search query                                     |
| `search`     | string | Legacy compatibility query param                         |
| `categoryId` | number | Optional category filter                                 |
| `priceMin`   | number | Optional minimum price                                   |
| `priceMax`   | number | Optional maximum price                                   |
| `page`       | number | Current page (default 1)                                 |
| `pageSize`   | number | Page size (default 12, max 50 enforced by service layer) |

**Normalization Rules:**

- `query = trim(q ?? search)`
- Empty or whitespace-only query becomes `undefined`
- Any search term update resets page to `1`

### UI Interaction Rules

- Search input is debounced (~350ms)
- Search submit is supported explicitly
- Clearing search removes `q` and `search` from URL
- Category/price/page/pageSize updates are composed in URL state
- Product retrieval stays server-backed (no client list filtering)

### Empty Query Behavior

If no search term is provided (`q` absent or empty), repository skips `.textSearch(...)` and returns default active listing with filters/pagination only.

---

## Repository Query Strategy

**File:** `lib/repositories/product.repository.ts`

```typescript
if (filters.query) {
  query = query.textSearch('search_vector', filters.query, {
    type: 'websearch',
    config: 'english',
  });
}
```

**Composition Order:**

1. Base scope: `status = 'active'`
2. Price range (`gte` / `lte`)
3. Category filter (`eq('category_id', ...)`)
4. Full-text search (`.textSearch(...)`) when query exists
5. Ordering by `created_at desc`
6. Pagination via `.range(offset, offset + pageSize - 1)`

---

## Routes Reference

| Route                  | Access               | Description                                                |
| ---------------------- | -------------------- | ---------------------------------------------------------- |
| `/buyer`               | buyer, seller (mode) | Buyer landing page with integrated product browse + search |
| `/buyer/products`      | buyer-facing         | Dedicated product listing page with search and filters     |
| `/buyer/products/[id]` | buyer-facing         | Product detail page (category links feed buyer browsing)   |

**Role Behavior Note:** Seller users default to `/seller`, but buyer-mode and browse param handling allow controlled buyer browsing flows.

---

## Refresh/Revalidation Behavior

Search is read-only and URL-driven, so no explicit `revalidatePath(...)` calls were required for PROD-03.

Behavior is achieved by:

- Server-rendered data on route transition
- Query-param updates via `router.replace(...)`
- `useTransition` pending state in listing/search components

---

## Loading, No-Results, and Error States

### Loading

- Listing shows spinner + "Loading products..." when transitions are pending.

### No Results

- Listing shows empty-state card with context-aware message.
- If active filters/search exist, a clear-filters action is shown.

### Error Handling

- Repository throws on Supabase query errors.
- Service throws domain validation errors (e.g., min price > max price).
- Server pages log and rethrow to Next.js error boundary flow.

---

## Key Constraints & Gotchas

### 1. This is PostgreSQL Full-Text Search, not Semantic Search

The implementation uses lexical matching with `tsvector/tsquery` via Supabase `.textSearch(...)`. It does not use embedding/vector nearest-neighbor search.

### 2. `search_vector` Must Exist Before Runtime Search

If migration SQL is not executed, `.textSearch('search_vector', ...)` will fail at runtime.

### 3. Category Name Search Depends on Trigger Maintenance

Category renames rely on `trg_categories_refresh_products_search_vector` to refresh dependent product vectors.

### 4. Query Param Compatibility (`q` and `search`)

Service layer accepts both to prevent breakage from legacy links, but UI canonicalizes to `q`.

### 5. Numeric Parsing Boundaries

- Invalid numbers are ignored (become `undefined`)
- `page` coerces to positive integer
- `pageSize` capped to 50
- `categoryId` must be positive integer

### 6. Buyer Landing vs Dedicated Products Route

Search/filter state is handled in both `/buyer` and `/buyer/products` flows. Route-specific role behavior for sellers must preserve buyer-mode expectations.

---

## Testing Checklist

1. Empty query returns normal active listing
2. Keyword query filters products by full-text index
3. Query + category filter compose correctly
4. Query + price range compose correctly
5. Pagination works while query is active
6. Search input debounce updates URL and resets page to 1
7. Category rename in DB updates product searchability (trigger verification)
8. No-results UI appears for unmatched query and recovers after clear

---

## Future Considerations

### Not Yet Implemented

1. Multi-language search dictionaries (currently `english` only)
2. Search ranking diagnostics/analytics for buyer query behavior
3. Synonym dictionary support for domain-specific vocabulary
4. Query typo tolerance beyond FTS stemming behavior
5. Hybrid lexical + embedding retrieval for semantic expansion
6. Dedicated migration tracking under a timestamped migrations folder

---

## Summary

PROD-03 delivers a production-usable buyer full-text search capability backed by Supabase/PostgreSQL FTS with weighted vectors, triggers, backfill, and indexing.

The feature follows BuySmart's layered architecture and supports URL-driven buyer interactions with consistent loading/no-results UX and composable filters.

Implemented scope includes:

- Database vectorization + index strategy
- End-to-end search query flow through action/controller/service/repository
- RSC-based buyer listing integration
- Debounced URL search input with compatibility handling

---

**Document Maintainers:** Development Team  
**Last Reviewed:** March 2026  
**Next Review:** (Upon search ranking enhancements or semantic retrieval rollout)

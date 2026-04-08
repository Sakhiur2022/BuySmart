# FB-02: Feedback API Endpoints (CRUD + Query)

**Document Version:** 1.0  
**Status:** Implemented  
**Sprint:** Sprint-3  
**Last Updated:** April 2026

---

## Overview

FB-02 implements feedback CRUD and query APIs using the existing layered architecture and Supabase-backed authorization rules. The scope delivered in this branch adds:

- **GET /api/feedback** for authenticated feedback listing with pagination, filters, and sorting
- **GET /api/feedback/[id]** for authenticated feedback detail retrieval
- **POST /api/feedback** for buyer feedback creation
- **PUT /api/feedback/[id]** for feedback update
- **DELETE /api/feedback/[id]** for soft-delete (status-based archival)
- **Role-aware authorization** across buyer, seller, admin, and moderator
- **Zod validation** for query params, payloads, and route params

The implementation adds a full feedback module across model, repository, service, controller, and API route layers.

---

## User Stories Covered

| Story ID | Title                                                                  | Status         |
| -------- | ---------------------------------------------------------------------- | -------------- |
| US-XX    | Buyer can create and manage own feedback                               | ✅ Implemented |
| US-XX    | Buyer can list feedback with filters and pagination                    | ✅ Implemented |
| US-XX    | Seller can read feedback scoped to own products                        | ✅ Implemented |
| US-XX    | Admin/Moderator can read and moderate feedback                         | ✅ Implemented |
| US-XX    | Unauthorized or invalid feedback operations are blocked with clear API errors | ✅ Implemented |

---

## Scope from Main Diff

The following changes were identified from current branch vs `main`:

### New Files

- `main-app/app/api/feedback/route.ts`
- `main-app/app/api/feedback/[id]/route.ts`
- `main-app/lib/models/feedback.model.ts`
- `main-app/lib/repositories/feedback.repository.ts`
- `main-app/lib/services/feedback.service.ts`
- `main-app/lib/controllers/feedback.controller.ts`

### Modified Files

- None in the FB-02 diff against `main`.

### No Database Migration Changes in FB-02

- No new SQL migration file was added.
- No generated database type regeneration was required for this diff.
- Existing `feedback` table schema/types were reused.

---

## API Contracts

### GET /api/feedback

**Access:** Authenticated user (role-aware scoped results)  
**Validation:**

- `page`: positive integer, default `1`
- `pageSize`: integer `1..100`, default `20`
- `productId`: UUID (optional)
- `orderId`: UUID (optional)
- `userId`: UUID (optional)
- `status`: enum (`draft|published|hidden|flagged|archived`)
- `feedbackType`: enum (`product_review|seller_review|service_feedback|general_feedback`)
- `ratingMin`: integer `1..5` (optional)
- `ratingMax`: integer `1..5` (optional)
- `sortBy`: enum (`recent|oldest|rating-high|rating-low|helpful`), default `recent`

**Success Response (200):**

```json
{
	"feedback": [
		{
			"feedback_id": "uuid",
			"user_id": "uuid",
			"product_id": "uuid",
			"order_id": "uuid",
			"order_item_id": "uuid",
			"feedback_type": "product_review",
			"rating": 5,
			"title": "Great product",
			"comment": "Arrived fast and works well.",
			"images": ["https://..."],
			"status": "published",
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

### GET /api/feedback/[id]

**Access:** Authenticated user with role-based read scope  
**Validation:**

- `id`: UUID (Zod route param schema)

**Success Response (200):**

```json
{
	"feedback": {
		"feedback_id": "uuid",
		"feedback_type": "product_review",
		"rating": 4,
		"title": "Solid value",
		"comment": "Satisfied with the purchase.",
		"status": "published",
		"user_id": "uuid",
		"product_id": "uuid",
		"created_at": "...",
		"updated_at": "..."
	}
}
```

### POST /api/feedback

**Access:** Authenticated user, buyer role only  
**Validation:**

- `feedback_type`: required enum (`product_review|seller_review|service_feedback|general_feedback`)
- `product_id`: UUID (optional)
- `order_id`: UUID (optional)
- `order_item_id`: UUID (optional)
- `rating`: integer `1..5` (optional)
- `title`: max `255` chars (optional)
- `comment`: max `5000` chars (optional)
- `images`: array of URL strings, max `10` (optional)
- `status`: enum (`draft|published|hidden|flagged|archived`) (optional)

Service-level rule:

- At least one of `product_id` or `order_id` must be provided.

**Success Response (201):**

```json
{
	"feedback": {
		"feedback_id": "uuid",
		"feedback_type": "product_review",
		"status": "published",
		"user_id": "uuid",
		"created_at": "...",
		"updated_at": "..."
	}
}
```

### PUT /api/feedback/[id]

**Access:** Authenticated user with role-based update scope  
**Validation:**

- `id`: UUID route param
- Update payload fields are optional and nullable where applicable
- At least one field must be provided

**Success Response (200):**

```json
{
	"feedback": {
		"feedback_id": "uuid",
		"status": "published",
		"updated_at": "..."
	}
}
```

### DELETE /api/feedback/[id]

**Access:** Authenticated user with role-based delete scope  
**Behavior:** Soft delete only (`status = archived`)  
**Validation:**

- `id`: UUID route param

**Success Response (200):**

```json
{
	"feedback": {
		"feedback_id": "uuid",
		"status": "archived",
		"updated_at": "..."
	}
}
```

---

## Error Handling Behavior

All endpoints follow existing API response conventions:

- `401`: `Unauthorized: Not authenticated`
- `403`: `Forbidden: Insufficient permissions`
- `404`: `Feedback not found`
- `409`: duplicate-key conflict for unique feedback constraints
- `400`: validation failures (`Validation failed` + flattened zod issues), invalid JSON payload, and service-level invalid input rules
- `500`: `Internal server error`

---

## Layered Architecture Updates

### Models

**File:** `lib/models/feedback.model.ts`

Added feedback contracts:

- `Feedback`
- `FeedbackType`
- `FeedbackStatus`
- `FeedbackSortBy`
- `CreateFeedbackInput`
- `UpdateFeedbackInput`
- `FeedbackListFilters`
- `FeedbackViewerScope`
- `FeedbackListResult`

### Repository

**File:** `lib/repositories/feedback.repository.ts`

Added feedback data-access functions:

- `fetchUserRole(userId)`
- `fetchFeedbackById(feedbackId)`
- `fetchSellerOwnedProductIds(sellerId)`
- `isSellerOwnerOfProduct(sellerId, productId)`
- `fetchFeedbackListForScope(filters, scope)`
- `createFeedback(userId, input)`
- `updateFeedbackById(feedbackId, input)`
- `softDeleteFeedbackById(feedbackId, moderatorId?)`

### Service

**File:** `lib/services/feedback.service.ts`

Added business-layer functions and role enforcement:

- `listFeedbackForScope(userId, filters)`
- `getFeedbackByIdForScope(userId, feedbackId)`
- `createFeedbackForUser(userId, input)`
- `updateFeedbackForScope(userId, feedbackId, input)`
- `softDeleteFeedbackForScope(userId, feedbackId)`

Role and policy behavior:

- buyer: create feedback, mutate own feedback, read own + published feedback
- seller: read feedback scoped to own products
- admin/moderator: broad read/update/delete moderation scope

### Controller

**File:** `lib/controllers/feedback.controller.ts`

Added thin delegation wrappers:

- `getFeedbackList`
- `getFeedbackById`
- `createFeedback`
- `updateFeedback`
- `deleteFeedback`

### API Routes

**Files:**

- `app/api/feedback/route.ts`
	- added `GET /api/feedback`
	- added `POST /api/feedback`
	- zod query/body validation and standardized error mapping
- `app/api/feedback/[id]/route.ts`
	- added `GET /api/feedback/[id]`
	- added `PUT /api/feedback/[id]`
	- added `DELETE /api/feedback/[id]`
	- UUID route param validation and standardized error mapping

---

## Data Flow

### GET /api/feedback

1. API route validates query params with zod.
2. API route authenticates user via `requireAuthenticatedUser`.
3. Service resolves viewer role/scope.
4. Repository executes role-scoped filtered query.
5. Service computes pagination metadata.
6. API returns `200` JSON response.

### GET /api/feedback/[id]

1. API route validates `id` param as UUID.
2. API route authenticates user.
3. Service resolves role and read access.
4. Repository fetches feedback by id.
5. API returns `200` or mapped error.

### POST /api/feedback

1. API route authenticates user.
2. API route parses and validates JSON payload with zod.
3. Service enforces buyer role and business rules.
4. Repository inserts feedback row.
5. API returns `201` with created feedback.

### PUT /api/feedback/[id]

1. API route validates `id` and update payload.
2. API route authenticates user.
3. Service checks mutation permissions and normalizes update input.
4. Repository updates feedback row.
5. API returns `200` with updated feedback.

### DELETE /api/feedback/[id]

1. API route validates `id`.
2. API route authenticates user.
3. Service checks delete permissions.
4. Repository performs soft delete (`archived`).
5. API returns `200` with archived feedback.

---

## File Structure Map (FB-02)

### New Files Created

```
app/api/feedback/
	├─ route.ts
	│		├─ GET /api/feedback
	│		└─ POST /api/feedback
	└─ [id]/route.ts
			├─ GET /api/feedback/[id]
			├─ PUT /api/feedback/[id]
			└─ DELETE /api/feedback/[id]

lib/models/
	└─ feedback.model.ts

lib/repositories/
	└─ feedback.repository.ts

lib/services/
	└─ feedback.service.ts

lib/controllers/
	└─ feedback.controller.ts
```

### Modified Files

```
None
```

---

## Testing Checklist

1. GET `/api/feedback` without session returns `401`
2. GET `/api/feedback` with invalid query (for example `page=0`) returns `400`
3. GET `/api/feedback?page=1&pageSize=20&sortBy=recent` returns `200` with pagination block
4. GET `/api/feedback/[id]` with invalid UUID returns `400`
5. POST `/api/feedback` with non-buyer role returns `403`
6. POST `/api/feedback` with missing both `product_id` and `order_id` returns `400`
7. PUT `/api/feedback/[id]` with empty payload returns `400`
8. PUT `/api/feedback/[id]` for unauthorized owner returns `403`
9. DELETE `/api/feedback/[id]` archives feedback and returns `200`
10. Duplicate feedback create request on unique key path returns `409`

---

## Constraints and Notes

1. FB-02 introduces API and backend layering only; no UI/client changes were added.
2. Delete behavior is soft-delete via `status = archived`; no hard delete endpoint behavior is used.
3. Authorization is enforced at multiple layers:
	 - session auth in API layer
	 - role and ownership checks in service layer
	 - scoped query behavior in repository layer

---

## Summary

FB-02 successfully adds production-style feedback APIs aligned with project conventions:

- layered architecture compliance
- strict auth and role enforcement
- zod validation at route boundaries
- consistent response/error shapes
- scoped and safe data access for all supported roles

The documentation reflects exact feedback API changes identified from current branch diff against `main`.

---

**Document Maintainers:** Development Team  
**Last Reviewed:** April 2026  
**Next Review:** (After feedback UI integration and endpoint test automation)

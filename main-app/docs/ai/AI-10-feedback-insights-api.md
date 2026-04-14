# AI-10: Feedback Insights API (Aggregated Analytics)

**Document Version:** 1.0  
**Status:** Implemented (feature/feedback-insights-api)  
**Sprint:** Sprint-3  
**Last Updated:** April 2026

---

## Overview

AI-10 implements a protected analytics endpoint for aggregated feedback insights.

This branch adds a new `GET /api/insights` route that provides:

- Role-aware insights access (admin/moderator platform scope, seller self scope)
- Timeframe filtering (`7d`, `30d`, `all`)
- Sentiment breakdown counts and percentages
- Average sentiment score derived from persisted AI-09 sentiment fields
- Positive/negative feedback highlights
- Trend series (daily buckets for `7d`/`30d`, monthly for `all`)
- Strict Zod validation for both request and response payloads

Implementation is server-first and reuses existing feedback sentiment persistence fields (`ai_sentiment`, `ai_confidence_score`, `ai_processed_at`) without changing sentiment analysis logic.

---

## Branch Diff Summary (Current Branch vs main)

Compared branch: `feature/feedback-insights-api` against `main`

### Added Files

1. `main-app/app/api/insights/route.ts`
2. `main-app/docs/ai/AI-10-feedback-insights-api.md`
3. `main-app/lib/services/insights.service.ts`
4. `main-app/lib/types/insights.types.ts`
5. `main-app/tests/integration/api/insights.route.test.ts`
6. `main-app/tests/unit/services/insights.service.test.ts`

### Modified Files

1. `main-app/lib/repositories/feedback.repository.ts`

---

## User Stories Covered

| Story ID | Title                                                                 | Status      |
| -------- | --------------------------------------------------------------------- | ----------- |
| AI-10    | Seller can view aggregated sentiment insights for own feedback        | Implemented |
| AI-10    | Admin/moderator can view platform-wide or seller-filtered insights    | Implemented |
| AI-10    | API returns total count, sentiment mix, average score, and trend data | Implemented |
| AI-10    | API validates filters and rejects invalid timeframe/seller id         | Implemented |
| AI-10    | API enforces role-based access policy (buyer denied)                  | Implemented |
| AI-10    | Insights logic covered by integration and unit tests                  | Implemented |

---

## API Contract

### Endpoint

- Method: `GET`
- Route: `/api/insights`
- Auth: required

### Query Parameters

- `sellerId` (optional UUID)
- `timeframe` (optional enum): `7d | 30d | all`
  - default: `30d`

### Access Rules

1. `admin` and `moderator`
   - Can request platform-level insights
   - Can optionally filter by `sellerId`
2. `seller`
   - Always scoped to authenticated seller id
   - If `sellerId` is provided and differs from authenticated seller id -> `403`
3. `buyer`
   - Access denied -> `403`
4. Unauthenticated
   - `401`

### Success Response Shape

```json
{
  "timeframe": "30d",
  "scope": {
    "level": "platform",
    "sellerId": "optional-uuid"
  },
  "generatedAt": "2026-04-14T00:00:00.000Z",
  "totalFeedbackCount": 12,
  "sentimentBreakdown": {
    "totalClassified": 12,
    "positive": { "count": 6, "percentage": 50 },
    "neutral": { "count": 3, "percentage": 25 },
    "negative": { "count": 2, "percentage": 16.67 },
    "mixed": { "count": 1, "percentage": 8.33 }
  },
  "averageSentimentScore": 0.29,
  "highlights": {
    "positive": [],
    "negative": []
  },
  "trend": []
}
```

### Error Mapping

1. `400` -> validation failed or invalid request values
2. `401` -> unauthenticated
3. `403` -> forbidden role/scope
4. `500` -> internal server error

---

## Types and Validation

### New Types File

**File:** `lib/types/insights.types.ts`

Defines:

1. `InsightsTimeframe` (`7d | 30d | all`)
2. `InsightsQueryInput`
3. `FeedbackInsightsResponse`
4. `FeedbackTrendPoint`
5. `FeedbackHighlight`
6. `SentimentMetric`

### Zod Schemas

1. `insightsQuerySchema`
   - validates `sellerId` UUID
   - validates timeframe enum with default `30d`
2. `feedbackInsightsResponseSchema`
   - validates output contract before returning response

This keeps API output deterministic and type-safe even if service code changes.

---

## Architecture and Data Flow

### Layer Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ HTTP Request                                                │
│ GET /api/insights                                           │
└───────────────────────────────┬─────────────────────────────┘
                                │
                ┌───────────────▼────────────────┐
                │ Route Layer                     │
                │ app/api/insights/route.ts       │
                │ - auth check                    │
                │ - query parse (zod)             │
                │ - error/status mapping           │
                └───────────────┬────────────────┘
                                │
                ┌───────────────▼────────────────┐
                │ Service Layer                   │
                │ lib/services/insights.service.ts│
                │ - role scope resolution         │
                │ - metric calculations           │
                │ - highlights and trend shaping  │
                └───────────────┬────────────────┘
                                │
                ┌───────────────▼────────────────┐
                │ Repository Layer                │
                │ lib/repositories/feedback...    │
                │ - aggregated Supabase queries   │
                └───────────────┬────────────────┘
                                │
                ┌───────────────▼────────────────┐
                │ Supabase PostgreSQL             │
                │ feedback + products + profile   │
                └─────────────────────────────────┘
```

### Why This Layering

1. Route remains thin and consistent with existing API style.
2. Business math and scope logic stays in service for easier testing.
3. Data access remains isolated in repository for query reuse.

---

## Repository Query Strategy

**Updated File:** `lib/repositories/feedback.repository.ts`

### New Interfaces

1. `FeedbackInsightsFilters`
2. `FeedbackInsightsRecord`

### New Functions

1. `countPublishedFeedbackForInsights(filters)`
   - counts published feedback
   - optional seller scoping via seller product ids
   - optional timeframe lower bound (`fromDateIso`)

2. `fetchProcessedFeedbackForInsights(filters)`
   - returns rows needed for sentiment analytics:
     - `feedback_id`, `title`, `comment`, `created_at`, `ai_sentiment`, `ai_confidence_score`
   - filters to:
     - `status = published`
     - `ai_sentiment IS NOT NULL`
     - `ai_processed_at IS NOT NULL`
   - optional seller and timeframe filters

### Query Efficiency Notes

1. Uses filtered/selective fetch fields for analytics payload.
2. Uses existing product ownership helper for seller scoping.
3. Avoids per-row DB lookups in service layer.

---

## Aggregation and Scoring Rules

**File:** `lib/services/insights.service.ts`

### Sentiment Scoring Derivation (from persisted values)

1. `positive` -> `+confidence`
2. `negative` -> `-confidence`
3. `neutral` -> `0`
4. `mixed` -> `0`

`confidence` is clamped to `[0, 1]` before score derivation.

### Metric Computation

1. `totalFeedbackCount` from published feedback count query
2. `totalClassified` from processed sentiment rows
3. Percentages = `count / totalClassified * 100` with zero-denominator guard
4. `averageSentimentScore` computed over processed rows

### Highlights

1. Positive highlights:
   - only `ai_sentiment = positive`
   - sorted by confidence desc then created_at desc
   - top 3 entries
2. Negative highlights:
   - same strategy for `negative`
3. Snippet formation:
   - title + comment merged, whitespace normalized, truncated

### Trend Bucketing

1. `7d` -> 7 daily buckets
2. `30d` -> 30 daily buckets
3. `all` -> monthly buckets from first record month to current month

Each bucket includes:

- total
- positive/neutral/negative/mixed counts
- averageSentimentScore

---

## File Structure Map

### New Files

```
main-app/app/api/insights/
  └─ route.ts
     └─ GET /api/insights handler

main-app/lib/services/
  └─ insights.service.ts
     ├─ scope resolution
     ├─ sentiment metrics
     ├─ highlights extraction
     └─ trend generation

main-app/lib/types/
  └─ insights.types.ts
     ├─ query schema
     ├─ response schema
     └─ insights DTO types

main-app/tests/integration/api/
  └─ insights.route.test.ts

main-app/tests/unit/services/
  └─ insights.service.test.ts

main-app/docs/ai/
  └─ AI-10-feedback-insights-api.md
```

### Updated Files

```
main-app/lib/repositories/feedback.repository.ts
  ├─ FeedbackInsightsFilters
  ├─ FeedbackInsightsRecord
  ├─ countPublishedFeedbackForInsights
  └─ fetchProcessedFeedbackForInsights
```

---

## Testing Coverage Added

### Integration Tests

**File:** `tests/integration/api/insights.route.test.ts`

Covered cases:

1. 200 success with valid request
2. 400 invalid query params
3. 401 unauthenticated
4. 403 forbidden
5. 500 invalid service response shape

### Unit Tests

**File:** `tests/unit/services/insights.service.test.ts`

Covered cases:

1. Admin platform scope aggregation
2. Seller forced self-scope
3. Seller cross-scope rejection
4. Buyer rejection
5. All-time monthly trend behavior

### Command Used

```powershell
npm.cmd run test -- tests/integration/api/insights.route.test.ts tests/unit/services/insights.service.test.ts
```

### Verified Result

- Test files: 2 passed
- Tests: 10 passed

---

## Constraints and Notes

1. No new npm dependencies were introduced.
2. No schema migration was added for AI-10.
3. Endpoint consumes existing AI-09 persisted fields and does not invoke LLM models.
4. Buyer access is intentionally denied for this endpoint.
5. Lint issues observed in repository are pre-existing in unrelated generated/coverage files.

---

## Future Considerations

1. Add dedicated repository-level SQL aggregation (group-by in DB) if dataset grows significantly.
2. Add optional pagination for highlights when analytics UI requires deeper drill-down.
3. Add explicit cache-control strategy once API-wide cache policy is standardized.
4. Add seller/category segment breakdown extensions.

---

## Summary

AI-10 on `feature/feedback-insights-api` introduces a production-ready, role-aware feedback analytics endpoint with strict request/response validation, reusable service/repository architecture, and test coverage for key auth/validation/aggregation flows.

Compared to `main`, this branch adds new insights route/service/type/test modules and extends feedback repository with analytics query functions.

Validated implementation:

- `GET /api/insights` implemented and protected
- role matrix enforced (`admin/moderator`, `seller`, `buyer`)
- sentiment breakdown, average score, highlights, and trends returned
- `10/10` targeted tests passed

---

**Document Maintainers:** Development Team  
**Last Reviewed:** April 2026  
**Next Review:** After insights UI integration and analytics scaling updates

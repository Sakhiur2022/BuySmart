# INT-05: Feedback API -> Sentiment Agent Pipeline

**Document Version:** 1.0  
**Status:** Implemented  
**Sprint:** Sprint-3  
**Last Updated:** April 2026

---

## Overview

INT-05 wires feedback sentiment analysis through the established layered architecture in this codebase:

- **API Route -> Controller -> Service -> Agent -> Repository -> DB persistence**
- Adds sentiment execution on **explicit analyze endpoint** and **feedback submission flow**
- Preserves stable feedback API response envelopes while improving AI failure categorization
- Keeps data writes repository-bound (no direct DB writes from route/service/agent)
- Adds tests to validate contracts and boundary behavior

This implementation is intentionally service-first and async-safe, with best-effort sentiment processing on feedback creation.

---

## User Stories Covered

| Story ID | Title                                                                 | Status      |
| -------- | --------------------------------------------------------------------- | ----------- |
| US-XX    | Buyer/system can analyze a feedback item on demand                    | Implemented |
| US-XX    | Feedback sentiment metadata is persisted to feedback AI columns       | Implemented |
| US-XX    | Feedback submission can trigger sentiment flow without route coupling | Implemented |
| US-XX    | API exposes provider failure category without changing envelope shape | Implemented |
| US-XX    | Layer contracts are validated by unit and integration tests           | Implemented |

---

## Branch Diff Source

Current branch was compared against `main` using:

```bash
git diff --name-status main...HEAD
```

INT-05-relevant files in this diff:

1. `main-app/app/api/feedback/[id]/analyze-sentiment/route.ts`
2. `main-app/lib/controllers/feedback.controller.ts`
3. `main-app/lib/services/ai/error-handler.ts`
4. `main-app/lib/services/feedback-analysis.service.ts`
5. `main-app/tests/integration/api/feedback-analyze-sentiment.route.test.ts`
6. `main-app/tests/integration/api/feedback.route.test.ts`
7. `main-app/tests/unit/controllers/feedback.controller.test.ts`
8. `main-app/tests/unit/services/feedback-analysis.service.test.ts`

```bash
git diff --stat main...HEAD -- <int-05-file-list>
```

Result:

- 8 files changed
- 354 insertions
- 23 deletions

---

## API Contract Impact

### 1. POST /api/feedback/[id]/analyze-sentiment

**Route file:** `app/api/feedback/[id]/analyze-sentiment/route.ts`

Behavior retained:

- `200` success with `{ feedback, analysis }`
- `400/401/403/404/500` mappings remain intact

Behavior enhanced:

- `502` AI failures now include a categorized provider hint in message text
- Envelope remains unchanged as `{ error: string }`

Example `502` message:

```json
{
  "error": "Sentiment analysis provider failed (timeout). Please retry shortly."
}
```

### 2. POST /api/feedback

**Route file:** `app/api/feedback/route.ts`

Behavior retained:

- Response envelope remains `{ feedback }` with status `201`

Behavior enhanced via controller/service orchestration:

- Submission path can now run sentiment analysis and persist AI fields
- If analysis fails due to provider or empty text, creation still succeeds (best effort)

---

## Architecture and Data Flow

### Layer Diagram

```text
POST /api/feedback/[id]/analyze-sentiment
	-> API Route (auth + param validation + error shaping)
	-> Controller (delegation)
	-> Feedback Analysis Service (compose payload, dispatch agent, map persistence)
	-> Agent Orchestrator (task dispatch)
	-> Sentiment Agent (model inference + parse)
	-> Feedback Repository (persist ai_* fields)
	-> DB feedback row

POST /api/feedback
	-> API Route (auth + body validation)
	-> Controller createFeedback
	-> Feedback Service createFeedbackForUser (existing create rules)
	-> Feedback Analysis Service analyzeFeedbackSentimentForCreatedFeedback (best effort)
	-> (same agent/repository pipeline when analyzable)
```

### Why this layering matters

- Route handlers remain thin and do not call agents directly
- AI error normalization/categorization remains service-layer concern
- Persistence remains repository-only
- Controller orchestrates cross-service flow while preserving route contract

---

## Key Implementation Details

### Service orchestration additions

**File:** `lib/services/feedback-analysis.service.ts`

Added/updated behavior:

1. Throws stable validation error for empty analyzable text:
   - `Feedback text is required for sentiment analysis`
2. Wraps orchestrator errors as:
   - `AI_ANALYSIS_FAILED:<category>:<message>`
3. Retains repository persistence mapping to:
   - `ai_sentiment`
   - `ai_confidence_score`
   - `ai_category`
   - `ai_urgency`
   - `ai_keywords`
   - `ai_processed_at`
4. Adds `analyzeFeedbackSentimentForCreatedFeedback(userId, feedback)`:
   - success: returns persisted analyzed feedback
   - non-blocking failures (empty text or AI failure): returns original created feedback
   - non-analysis failures: rethrows

### Controller orchestration update

**File:** `lib/controllers/feedback.controller.ts`

`createFeedback` now:

1. creates feedback via `createFeedbackForUser`
2. calls `analyzeFeedbackSentimentForCreatedFeedback`
3. returns resulting feedback object (envelope unchanged at route level)

### AI error categorization utility

**File:** `lib/services/ai/error-handler.ts`

Added:

- `AIErrorCategory` union:
  - `timeout`
  - `rate_limit`
  - `configuration`
  - `response`
  - `request`
  - `provider`
- `categorizeAIError(error)` classifier based on code/status/message heuristics

### Analyze route formatting enhancement

**File:** `app/api/feedback/[id]/analyze-sentiment/route.ts`

Added category display mapping for `AI_ANALYSIS_FAILED:*` messages while preserving `502` contract shape.

---

## File Structure Map

### New Files Created

```text
tests/integration/api/
	feedback.route.test.ts
		- POST /api/feedback integration coverage
		- stable envelope checks with submit-time sentiment fields
		- auth/validation error path checks
```

### Modified Files

| File                                                             | Change Summary                                             | Why                                             |
| ---------------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------- |
| `app/api/feedback/[id]/analyze-sentiment/route.ts`               | category-aware 502 formatting                              | expose failure category while preserving shape  |
| `lib/controllers/feedback.controller.ts`                         | create flow now invokes submit-time sentiment service      | enforce layered orchestration                   |
| `lib/services/ai/error-handler.ts`                               | added `AIErrorCategory` and `categorizeAIError`            | centralize provider error categorization        |
| `lib/services/feedback-analysis.service.ts`                      | categorized AI failure wrapping, best-effort create helper | shared sentiment pipeline + submit flow support |
| `tests/integration/api/feedback-analyze-sentiment.route.test.ts` | added categorized 502 assertions                           | verify route error contract                     |
| `tests/unit/controllers/feedback.controller.test.ts`             | added create-controller orchestration test                 | verify controller-level layering                |
| `tests/unit/services/feedback-analysis.service.test.ts`          | added category + best-effort scenarios                     | verify service boundary semantics               |

---

## Error Handling Matrix

| Source              | Internal Error Pattern              | API Status | API Message Shape              |
| ------------------- | ----------------------------------- | ---------- | ------------------------------ |
| Unauthenticated     | `UNAUTHENTICATED`                   | 401        | `{ error }`                    |
| Forbidden           | `FORBIDDEN`                         | 403        | `{ error }`                    |
| Missing feedback    | `Feedback not found`                | 404        | `{ error }`                    |
| Invalid params/body | validation errors                   | 400        | `{ error, issues? }`           |
| AI provider failure | `AI_ANALYSIS_FAILED:<category>:...` | 502        | `{ error }` with category text |
| Unknown             | non-mapped failures                 | 500        | `{ error }`                    |

---

## Behavioral Rules

### Analyze endpoint

1. Requires authenticated user.
2. Requires UUID route param.
3. Requires analyzable text (`title/comment` not both empty).
4. Runs sentiment pipeline and persists result on success.
5. Returns category-aware provider failure message on `502`.

### Feedback submission path

1. Creates feedback first using existing create service rules.
2. Attempts sentiment analysis as follow-up orchestration step.
3. Does not fail feedback creation for non-blocking analysis errors.
4. Returns created feedback shape consistently from API route.

### Concurrency policy

- No lock/idempotency layer introduced in INT-05.
- Effective behavior remains last-write-wins for concurrent analyze calls.

---

## Testing Coverage

### Unit Tests

**Service:** `tests/unit/services/feedback-analysis.service.test.ts`

Covered:

1. fetch -> dispatch -> persist happy path
2. empty text rejection
3. orchestrator error wrapping with category
4. timeout classification via `AIRequestError` + status
5. unsuccessful agent result with fallback message
6. confidence fallback from `confidenceScore`
7. submit-trigger success and non-blocking fallback branches
8. non-analysis rethrow branch

**Controller:** `tests/unit/controllers/feedback.controller.test.ts`

Covered:

1. analyze controller delegation
2. create controller orchestration with submit-time sentiment helper

### Integration Tests

**Analyze route:** `tests/integration/api/feedback-analyze-sentiment.route.test.ts`

Covered:

1. 200 success contract
2. 400 invalid UUID
3. 401 unauthenticated
4. 502 timeout category message
5. 502 rate-limit category message
6. 404 not found
7. 403 forbidden
8. 400 service validation surfaced
9. 500 unknown runtime failure

**Feedback POST route:** `tests/integration/api/feedback.route.test.ts`

Covered:

1. 201 success with stable `{ feedback }` envelope
2. 400 invalid JSON
3. 400 schema validation
4. 401 unauthenticated

---

## Verification Commands

Targeted validation command used:

```bash
npm.cmd run test -- \
	tests/unit/services/feedback-analysis.service.test.ts \
	tests/unit/controllers/feedback.controller.test.ts \
	tests/integration/api/feedback-analyze-sentiment.route.test.ts \
	tests/integration/api/feedback.route.test.ts
```

Observed result:

- 4 test files passed
- 26 tests passed

---

## Constraints and Gotchas

1. No DB schema changes were introduced in INT-05.
2. Submit-time sentiment is best effort by design; AI failure does not roll back feedback creation.
3. Error categorization is message-based at API surface to preserve response envelope compatibility.
4. Analyze endpoint remains strict and will return 400 for empty analyzable text.
5. Repository remains the only layer that writes AI sentiment fields.

---

## Out-of-Scope Branch Changes

The current branch diff also contains buyer UI/navigation updates not part of INT-05 sentiment pipeline implementation:

1. `app/(buyer)/buyer/dashboard/page.tsx`
2. `app/(buyer)/buyer/layout.tsx`
3. `app/(buyer)/buyer/page.tsx`
4. `components/shared/buyer-hub-menu.tsx`
5. `components/shared/navbar.tsx`

These are intentionally excluded from this integration document.

---

## Future Considerations

1. Add structured error codes in API payload (versioned contract update) instead of category text only.
2. Consider async queue/background processing for submit-time sentiment to reduce write latency.
3. Add idempotency guard or lock if concurrent analyze contention becomes visible in production.
4. Add end-to-end persistence verification in CI against isolated test database.

---

## Summary

INT-05 successfully integrates feedback sentiment analysis into the layered application pipeline while preserving stable route contracts. The branch now supports both explicit analyze execution and submit-time best-effort analysis, categorizes provider failures for clearer operator/user feedback, persists AI outputs through repository boundaries, and validates the behavior through expanded unit and integration tests.

---

**Document Maintainers:** Development Team  
**Last Reviewed:** April 2026  
**Next Review:** After queued async sentiment processing and structured error-code rollout

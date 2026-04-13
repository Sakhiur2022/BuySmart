# FB-08a Sentiment Verification Guide

Status: QA verification plan and executable checks for AI-08a

## Scope

This guide verifies the full sentiment stack:

- Agent behavior and parser expectations
- Service orchestration and error handling
- Repository persistence behavior
- Controller return contract
- API route status codes and response shape
- End-to-end API -> controller -> service -> agent -> repository -> database

## Preconditions

1. Start app in development mode:
   - `npm run dev`
2. Have one valid buyer session cookie copied from browser dev tools.
3. Have one delivered/valid order id owned by that buyer for creating `general_feedback`.
4. Optional: second buyer cookie for forbidden-path verification.
5. Optional (for direct DB verification):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

## Automated QA Script

Script file:

- `scripts/qa/verify-feedback-sentiment.mjs`

Run:

```bash
QA_BASE_URL=http://localhost:3000 \
QA_AUTH_COOKIE='YOUR_SESSION_COOKIE' \
QA_ORDER_ID='YOUR_ORDER_UUID' \
QA_OTHER_AUTH_COOKIE='OPTIONAL_SECOND_USER_COOKIE' \
npm run qa:sentiment
```

PowerShell example:

```powershell
$env:QA_BASE_URL = 'http://localhost:3000'
$env:QA_AUTH_COOKIE = 'YOUR_SESSION_COOKIE'
$env:QA_ORDER_ID = 'YOUR_ORDER_UUID'
$env:QA_OTHER_AUTH_COOKIE = 'OPTIONAL_SECOND_USER_COOKIE'
npm.cmd run qa:sentiment
```

### Automated coverage matrix

1. API auth guard:
   - Unauthenticated analyze request returns `401`.
2. API param validation:
   - Invalid feedback id returns `400`.
3. Service malformed-input branch:
   - Empty title/comment feedback returns `400` on analyze.
4. Authorization branch (optional):
   - Other buyer analyzing owner draft feedback returns `403`.
5. Agent + parser + service + repository happy paths:
   - Strongly positive feedback
   - Strongly negative feedback
   - Neutral feedback
   - Mixed sentiment feedback
   - Very short feedback
   - Unusually long feedback (within API limits)
6. Contract validation:
   - `analysis.sentiment`, `analysis.category`, `analysis.urgency` in enum values
   - `analysis.confidenceScore` in [0, 1]
   - `analysis.reasoningSummary` string
   - `analysis.keySignals` array
7. Persistence validation:
   - Response `feedback.ai_*` fields match `analysis` fields.
   - Optional direct DB verification confirms persisted `ai_sentiment`, `ai_confidence_score`, `ai_category`, `ai_urgency`, `ai_keywords`, `ai_processed_at`.

## Manual Deep Verification (Agent-focused)

Use these when validating real model quality beyond strict structural checks.

### A. Agent output structure and parser resilience

1. Submit feedback that should produce each sentiment class.
2. Confirm route returns structured JSON only (no freeform leakage).
3. Confirm parser fallback behavior does not crash requests.
4. Confirm `confidenceScore` remains numeric and bounded.
5. Confirm `keySignals` are concise and de-duplicated.

### B. Service error handling and secrecy

1. Trigger analyze with empty feedback text (created feedback with blank title/comment): expect safe `400` without stack traces.
2. Temporarily misconfigure AI key locally (`GROQ_API_KEY` missing): expect `502` route response with generic provider error.
3. Restore key and verify service recovers.

### C. Repository correctness

1. Run analyze on a feedback id.
2. Query `feedback` row in Supabase SQL editor and verify:
   - `ai_sentiment` enum value valid
   - `ai_confidence_score` within 0..1
   - `ai_category`, `ai_urgency` valid enums
   - `ai_keywords` text array
   - `ai_processed_at` timestamptz set
   - `updated_at` changed

### D. Controller contract consistency

1. Confirm API response object shape remains stable:
   - `{ feedback, analysis }` on success
   - `{ error }` on failures
2. Confirm no internal implementation details in controller-visible outputs.

## Known constraints

1. This repository currently has no dedicated unit test framework configured.
2. To avoid introducing a new test framework, automated verification is implemented as a native Node QA script focused on executable end-to-end and contract checks.
3. Fine-grained unit mocking (agent/service/repository internals) should be added later if a project-standard runner is introduced.

## Pass criteria

1. All automated script checks pass without assertion failures.
2. Manual deep verification confirms valid AI semantics and safe failure behavior.
3. Database rows persist sentiment metadata with correct schema-aligned types.
4. No response leaks raw AI provider internals or stack traces.

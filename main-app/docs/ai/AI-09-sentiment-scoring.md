# AI-09: Sentiment Scoring & Classification

**Document Version:** 1.0  
**Status:** Implemented (feature/sentiment-scoring)  
**Sprint:** Sprint-3  
**Last Updated:** April 2026

---

## Overview

AI-09 implements production-grade feedback sentiment scoring for the existing feedback analysis pipeline.

This branch adds:

- Four-class sentiment labeling: `positive`, `neutral`, `negative`, `mixed`
- Signed sentiment scoring (`-1.0` to `1.0`) with direction-safe normalization
- Confidence scoring (`0.0` to `1.0`) with fallback-safe persistence behavior
- Backward-compatible fields (`sentiment`, `confidenceScore`) alongside new fields (`label`, `score`, `confidence`)
- Expanded test coverage across agent, service, controller, and route layers
- Dedicated sentiment coverage configuration with enforced `80%+` thresholds

Implementation follows existing layered architecture and uses existing AI stack patterns (LangChain + Groq + Zod + BaseAgent/Orchestrator).

---

## Branch Diff Summary (Current Branch vs main)

Compared branch: `feature/sentiment-scoring` against `main`

### Added Files

1. `main-app/docs/ai/AI-09-sentiment-scoring.md`
2. `main-app/vitest.sentiment.config.ts`

### Modified Files

1. `main-app/lib/agents/agent-logger.ts`
2. `main-app/lib/agents/sentiment/sentiment-agent.ts`
3. `main-app/lib/services/feedback-analysis.service.ts`
4. `main-app/lib/types/feedback-sentiment.types.ts`
5. `main-app/package.json`
6. `main-app/tests/factories/feedback.factory.ts`
7. `main-app/tests/integration/api/feedback-analyze-sentiment.route.test.ts`
8. `main-app/tests/unit/agents/sentiment-agent.test.ts`
9. `main-app/tests/unit/controllers/feedback.controller.test.ts`
10. `main-app/tests/unit/services/feedback-analysis.service.test.ts`

---

## User Stories Covered

| Story ID | Title                                                           | Status      |
| -------- | --------------------------------------------------------------- | ----------- |
| AI-09    | Classify feedback as positive/neutral/negative/mixed            | Implemented |
| AI-09    | Return signed sentiment score and confidence in API response    | Implemented |
| AI-09    | Preserve existing compatibility fields for downstream consumers | Implemented |
| AI-09    | Ensure robust fallback on malformed model output                | Implemented |
| AI-09    | Improve sentiment route/service error-path test coverage        | Implemented |
| AI-09    | Enforce dedicated sentiment coverage threshold >= 80%           | Implemented |

---

## API and Type Contract

### Sentiment Output Contract

Updated in: `lib/types/feedback-sentiment.types.ts`

`FeedbackSentimentAgentOutput` now includes:

- `label`: sentiment enum (`positive | neutral | negative | mixed`)
- `sentiment`: compatibility alias for label
- `score`: signed score in `[-1, 1]`
- `confidence`: probability-like confidence in `[0, 1]`
- `confidenceScore`: compatibility alias for confidence
- existing `category`, `urgency`, `reasoningSummary`, `keySignals`

`FeedbackSentimentAnalysisMetadata` now includes:

- `label`, `sentiment`
- `score`, `confidence`, `confidenceScore`
- `category`, `urgency`, `reasoningSummary`, `keySignals`
- optional `model`, `latencyMs`, `cached`

### Backward Compatibility

The contract is additive.

- Existing consumers using `sentiment` and `confidenceScore` remain valid.
- New consumers can use `label`, `score`, and `confidence` as canonical fields.

---

## Scoring & Classification Logic

### Core Agent

File: `lib/agents/sentiment/sentiment-agent.ts`

#### Prompt Contract

The agent prompt now explicitly requires JSON with:

1. `label`
2. `score`
3. `confidence`
4. `category`
5. `urgency`
6. `reasoningSummary`
7. `keySignals`

#### Validation

Zod schema supports both current and legacy outputs:

- Accepts `label` or `sentiment`
- Accepts `confidence` or `confidenceScore`
- Validates ranges and required structural fields

#### Normalization Rules

1. Confidence normalization:
   - Clamp to `[0, 1]`
2. Score normalization:
   - Clamp to `[-1, 1]`
   - Enforce positive sign for `positive`
   - Enforce negative sign for `negative`
   - Force `0` for `neutral` and `mixed`
3. Fallback behavior:
   - Label -> `neutral`
   - Score -> `0`
   - Confidence -> `0`
   - Category -> `other`
   - Urgency -> `low`

#### Parse Robustness

Parser attempts in order:

1. Raw JSON parse
2. JSON inside fenced markdown block
3. Brace-extracted JSON from mixed text output
4. Deterministic fallback object

---

## Service & Persistence Behavior

### Feedback Analysis Service

File: `lib/services/feedback-analysis.service.ts`

Enhancements:

1. Persists sentiment enum from `result.label` (canonical field)
2. Computes persistence confidence using finite fallback chain:
   - use `result.confidence` when finite
   - otherwise use `result.confidenceScore`
   - clamp final value to `[0, 1]`
3. Returns expanded analysis payload including `label`, `score`, `confidence`

### Important Bug Fix Included

This branch also fixes a persistence edge case where `NaN` confidence could be passed through during service mapping.

---

## Logging/Observability

### Agent Logger

File: `lib/agents/agent-logger.ts`

`extractConfidence` now supports:

1. `confidence`
2. `confidenceScore`

This ensures activity log confidence capture works for both new and compatibility response shapes.

---

## Testing & Coverage

### Test Files Expanded

1. `tests/unit/agents/sentiment-agent.test.ts`
2. `tests/unit/services/feedback-analysis.service.test.ts`
3. `tests/integration/api/feedback-analyze-sentiment.route.test.ts`
4. `tests/unit/controllers/feedback.controller.test.ts`
5. `tests/factories/feedback.factory.ts`

### New Coverage Config

File: `vitest.sentiment.config.ts`

Scope-limited coverage include set:

1. `app/api/feedback/[id]/analyze-sentiment/route.ts`
2. `lib/agents/sentiment/sentiment-agent.ts`
3. `lib/services/feedback-analysis.service.ts`

Thresholds enforced:

- statements: 80
- branches: 80
- functions: 80
- lines: 80

### package.json Script Added

```json
"test:coverage:sentiment": "vitest run -c vitest.sentiment.config.ts --coverage"
```

### Verified Result (Branch)

Run command:

```powershell
npm.cmd run test:coverage:sentiment
```

Outcome:

- Test files: 4 passed
- Tests: 22 passed
- Coverage:
  - Statements: 97.27%
  - Branches: 87.14%
  - Functions: 100%
  - Lines: 97.27%

Coverage target `80%+` is satisfied.

---

## File Structure Map

### New Files

```
docs/ai/
	└─ AI-09-sentiment-scoring.md

main-app/
	└─ vitest.sentiment.config.ts
```

### Updated Core Implementation Files

```
main-app/lib/agents/sentiment/sentiment-agent.ts
	├─ added label/score/confidence parsing
	├─ added score/confidence normalization helpers
	├─ prompt updated to signed score contract
	└─ fallback result expanded

main-app/lib/services/feedback-analysis.service.ts
	├─ persists ai_sentiment from label
	├─ finite-safe confidence fallback logic
	└─ returns expanded analysis metadata

main-app/lib/types/feedback-sentiment.types.ts
	├─ extended output/metadata interfaces
	└─ kept compatibility fields

main-app/lib/agents/agent-logger.ts
	└─ extractConfidence now supports confidenceScore
```

### Updated Test/Tooling Files

```
main-app/package.json
	└─ added test:coverage:sentiment script

main-app/tests/factories/feedback.factory.ts
	└─ fixtures updated with label/score/confidence

main-app/tests/unit/agents/sentiment-agent.test.ts
	└─ parsing + normalization + fallback branch cases

main-app/tests/unit/services/feedback-analysis.service.test.ts
	└─ service error/fallback/persistence branch cases

main-app/tests/integration/api/feedback-analyze-sentiment.route.test.ts
	└─ route auth/validation/error mapping branches

main-app/tests/unit/controllers/feedback.controller.test.ts
	└─ metadata shape assertions updated
```

---

## Error Handling Behavior Covered

Route-level scenarios tested:

1. 200 success
2. 400 invalid UUID
3. 400 service validation-style message
4. 401 unauthenticated
5. 403 forbidden
6. 404 feedback not found
7. 502 upstream AI failure
8. 500 unknown runtime failure

Service-level scenarios tested:

1. Empty feedback text guard
2. Orchestrator thrown error wrapped as `AI_ANALYSIS_FAILED:*`
3. Unsuccessful orchestrator result with explicit message
4. Unsuccessful orchestrator result with default fallback message
5. Confidence fallback from `confidenceScore` when `confidence` is non-finite

---

## Constraints and Notes

1. No new npm dependencies were introduced.
2. No database migrations were added in this branch for AI-09.
3. Existing sentiment enum with `mixed` is preserved.
4. Signed score for `mixed` is intentionally normalized to `0`.
5. This branch provides sentiment-focused coverage guarantees, not global repository-wide coverage guarantees.

---

## Future Considerations

1. Add per-label confidence distribution (e.g., class probabilities) if provider output is upgraded.
2. Introduce optional persistence column for signed score if analytics requires DB-level querying.
3. Add load/perf tests for high-volume sentiment route usage.
4. Consider async queue-based analysis for burst traffic and cost control.

---

## Summary

AI-09 on `feature/sentiment-scoring` delivers a fully integrated sentiment classification/scoring upgrade over main, with stronger contracts, deterministic normalization, improved observability compatibility, expanded negative-path tests, and enforced sentiment coverage thresholds above 80%.

Branch implementation validated by tests and scoped coverage:

- `22/22` tests passed
- coverage thresholds met (`97.27%` statements, `87.14%` branches)

---

**Document Maintainers:** Development Team  
**Last Reviewed:** April 2026  
**Next Review:** After sentiment score persistence analytics or provider upgrade

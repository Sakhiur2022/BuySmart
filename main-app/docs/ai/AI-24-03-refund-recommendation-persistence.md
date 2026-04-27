# AI-24-03: Persist Refund Recommendation Metadata

**Document Version:** 1.0  
**Status:** Implemented  
**Sprint:** Sprint-4  
**Last Updated:** April 2026

---

## Overview

AI-24-03 persists AI recommendation output alongside refund records and exposes it through existing refund read surfaces while preserving admin-only reasoning visibility.

Implemented artifacts:

- `lib/repositories/refund-ai-recommendation.mapper.ts`
- `lib/services/refund.service.ts` integration updates
- Admin read strategy updates and refund read masking

---

## Design Pattern Flow

### Pipeline Pattern

Flow:

1. Refund is created
2. Adapter returns typed recommendation
3. Mapper translates recommendation to repository write shape
4. Repository persists `ai_recommendation`, `ai_risk_score`, `ai_analysis`, `ai_processed_at`
5. Read paths return data with role-based masking

Why used:

- Keeps persistence as an explicit composable step after recommendation generation
- Avoids embedding persistence internals in AI adapter layer

### Repository Pattern

Persistence continues through repository abstraction (`saveAIAnalysis`) rather than route-side data writes.

---

## SOLID Mapping

| Principle             | Application in AI-24-03                                                         |
| --------------------- | ------------------------------------------------------------------------------- |
| Single Responsibility | Mapper handles translation; service orchestrates pipeline; repository persists  |
| Open/Closed           | AI metadata can be extended in `ai_analysis` JSON without breaking base columns |
| Liskov Substitution   | Repository interface remains mockable in service/unit tests                     |
| Interface Segregation | Persistence consumes typed recommendation output only                           |
| Dependency Inversion  | Service depends on repository contract, not raw DB client                       |

---

## Storage Decision

Chosen location: existing refund table AI columns and JSON metadata.

Columns used:

- `ai_recommendation`
- `ai_risk_score`
- `ai_analysis`
- `ai_processed_at`

Rationale:

- Already integrated into list/detail/query surfaces
- Avoids immediate migration complexity
- Supports incremental metadata growth (`schema_version`, `model_metadata`, `signals`)

---

## Persistence Schema

`ai_analysis` JSON now carries:

- `recommendation`
- `risk_score`
- `confidence`
- `notes`
- `signals`
- `schema_version`
- `model_metadata`

Risk score precision:

- Persisted with 4-decimal precision for stable ranking/filtering

---

## Trigger Mechanism

Trigger point remains refund creation in refund service.

Behavior:

1. Try adapter-generated recommendation
2. Persist mapped recommendation
3. On failure, run heuristic fallback and persist fallback output
4. If persistence fails, return created refund object (non-blocking flow retained)

---

## Read Exposure and Visibility

Read surfaces:

- `GET /api/refunds` (RFND-04)
- `GET /api/refunds/[id]` (RFND-05)

Visibility policy:

- Admin: full `ai_analysis` including `notes` and `signals`
- Buyer/Seller: masked `ai_analysis` (reasoning fields removed)

---

## Admin Queue Prioritization Support

Admin refund queue continues consuming:

- `ai_recommendation`
- `ai_risk_score`
- `ai_analysis.confidence`
- `ai_analysis.notes` (admin-visible)

This supports current prioritization and review context without changing decision legality.

---

## Migration and Audit Notes

No mandatory schema migration required for initial delivery because existing AI columns are reused.

Future option:

- Introduce recommendation history table for full audit timeline if repeated analyses are later introduced.

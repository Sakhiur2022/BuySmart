# AI-06 — Recommendation API Endpoint

> **Status**: Implemented  
> **Created**: 2026-02-15  
> **Depends On**: AI-02 (Agent Architecture)

## Overview

This deliverable exposes a public API endpoint to generate product recommendations by invoking the Recommendation agent.

## Endpoint

- **Route**: `POST /api/recommendations`
- **Handler**: `app/api/recommendations/route.ts`

## Request Schema

```jsonc
{
  "userIntent": "string",
  "contextSummary": "string (optional)",
  "candidates": [
    {
      "id": "string",
      "title": "string",
      "category_id": 0, // optional
      "brand": "string (optional)",
      "price": 0,
      "tags": ["string"]
    }
  ],
  "constraints": {
    "budgetMin": 0,
    "budgetMax": 0,
    "category_ids": [0], // optional
    "brands": ["string"],
    "mustHaveTags": ["string"],
    "excludeProductIds": ["string"],
    "maxResults": 5
  }
}
```

## Response Shape

```jsonc
{
  "success": true,
  "result": {
    "summary": "string",
    "recommendations": [
      {
        "productId": "string",
        "title": "string",
        "reason": "string",
        "score": 0.0,
        "category_id": 0, // optional
        "price": 0
      }
    ]
  },
  "latencyMs": 0
}
```

## Notes

- Validation is enforced with Zod. Invalid payloads return `400`.
- When the agent fails, the endpoint returns `502` with `success: false`.
- If authenticated, the user id is attached to the agent context.

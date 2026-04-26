# ADMN-03: Admin Refund Decision API

## Summary

Introduces admin-only refund decision actions via dedicated POST action routes:

- `/api/refunds/[id]/approve`
- `/api/refunds/[id]/reject`
- `/api/refunds/[id]/review`

Each action persists status transition and processing metadata in the same repository update path.

## Decision outcomes

- `approve` -> `approved`
- `reject` -> `rejected`
- `review` -> `manual_review`

## Authorization

- Authenticated identity is required.
- Service layer resolves actor role via repository.
- Only `admin` role can execute decision actions.
- Non-admin actors receive `FORBIDDEN`.

## Metadata persistence

Each successful decision writes:

- `processed_by` (admin user id)
- `processed_at` (ISO timestamp)
- `processing_notes` (structured payload containing decision, previous status, and optional note)

The previous status is embedded in `processing_notes` as the audit trace for ADMN-03.

## Validation rules

- Route param `id` must be UUID.
- Approve/review notes are optional.
- Reject notes are required.
- Oversized derived notes payload is rejected.
- Illegal transitions are rejected with a domain transition error.

## Transition guards

Legal decision transitions:

- `pending` -> `approved | rejected | manual_review`
- `ai_review` -> `approved | rejected | manual_review`
- `manual_review` -> `approved | rejected`

All other transitions are blocked.

## Error mapping

Through shared refund error formatter:

- `400` validation and invalid decision payload
- `401` unauthenticated
- `403` forbidden
- `404` refund not found
- `409` conflict (concurrent update/status race)
- `422` invalid decision transition
- `500` unexpected errors

## Testing

ADMN-03 coverage includes:

- Unit: controller decision delegation
- Unit: service decision authorization and transition logic
- Unit: repository atomic decision update
- Integration: approve/reject/review route behavior and status mapping

# AI-05 — Product Embedding Generation

> **Status**: Implemented  
> **Created**: 2026-02-15  
> **Depends On**: AI-02 (Agent Architecture)

## Overview

This deliverable adds a product-level embedding pipeline for semantic recommendation/search enrichment.

Implemented capabilities:

- Build canonical embedding text from product fields.
- Generate embeddings via Hugging Face (`generateEmbedding`).
- Persist vectors to `products.embedding` (`pgvector`) with model metadata.
- Backfill embeddings in controllable batches.

## Data Model Changes

Updated `lib/supabase/db/schema.sql`:

- Enables `vector` extension.
- Adds to `products`:
  - `embedding vector(384)`
  - `embedding_model varchar(100)`
  - `embedding_updated_at timestamptz`
- Adds index:
  - `idx_products_embedding_ivfflat` using `vector_cosine_ops`

## Service API

Implemented in `lib/services/ai/models/product-embeddings.ts`:

- `buildProductEmbeddingText(content)`
- `generateProductEmbedding(content)`
- `persistProductEmbedding(supabase, result)`
- `generateAndPersistProductEmbedding(supabase, content)`
- `backfillProductEmbeddings(supabase, options)`
- `toPgVector(embedding)`
- `mapProductRowToEmbeddingContent(row)`

Backfill entrypoint in `lib/services/ai/generate-product-embeddings.ts`:

- `runProductEmbeddingBackfill(options)`

## Backfill Options

`backfillProductEmbeddings` supports:

- `batchSize` (default 20, capped at 200)
- `maxProducts` (optional cap)
- `onlyMissing` (default `true`)

Return payload includes success/failure counts and per-product failure reasons.

## Notes

- Vector dimension is aligned to default model `sentence-transformers/all-MiniLM-L6-v2` (384 dimensions).
- If the embedding model is changed, schema vector dimension must stay compatible.

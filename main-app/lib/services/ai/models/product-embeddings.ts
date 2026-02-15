import type { SupabaseClient } from "@supabase/supabase-js";

import { generateEmbedding } from "@/lib/services/ai/models/embeddings";
import type {
  ProductEmbeddingContent,
  ProductEmbeddingGenerationResult,
} from "@/lib/types/ai.types";
import type { Database } from "@/lib/types/database.types";

type ProductRow = Database["public"]["Tables"]["products"]["Row"];

type ProductSourceRow = Pick<
  ProductRow,
  "product_id" | "name" | "description" | "short_description" | "tags" | "sku"
>;

export interface ProductEmbeddingBackfillOptions {
  batchSize?: number;
  maxProducts?: number;
  onlyMissing?: boolean;
}

export interface ProductEmbeddingBackfillResult {
  processed: number;
  succeeded: number;
  failed: number;
  failures: Array<{ productId: string; reason: string }>;
}

export function buildProductEmbeddingText(content: ProductEmbeddingContent): string {
  const lines = [
    `product_id: ${content.id}`,
    `name: ${content.name}`,
    content.shortDescription ? `short_description: ${content.shortDescription}` : null,
    content.description ? `description: ${content.description}` : null,
    content.categoryName ? `category: ${content.categoryName}` : null,
    content.brand ? `brand: ${content.brand}` : null,
    content.sku ? `sku: ${content.sku}` : null,
    content.tags?.length ? `tags: ${content.tags.join(", ")}` : null,
  ].filter((value): value is string => Boolean(value && value.trim()));

  return lines.join("\n");
}

export async function generateProductEmbedding(
  content: ProductEmbeddingContent,
): Promise<ProductEmbeddingGenerationResult> {
  const embeddingText = buildProductEmbeddingText(content);
  const generated = await generateEmbedding(embeddingText);

  return {
    productId: content.id,
    model: generated.model,
    dimensions: generated.dimensions,
    embedding: generated.embedding,
    embeddingText,
  };
}

export function toPgVector(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

export function mapProductRowToEmbeddingContent(
  row: ProductSourceRow,
): ProductEmbeddingContent {
  return {
    id: row.product_id,
    name: row.name,
    description: row.description,
    shortDescription: row.short_description,
    tags: row.tags,
    sku: row.sku,
  };
}

export async function persistProductEmbedding(
  supabase: SupabaseClient<Database>,
  result: ProductEmbeddingGenerationResult,
): Promise<void> {
  const { error } = await supabase
    .from("products")
    .update({
      embedding: toPgVector(result.embedding),
      embedding_model: result.model,
      embedding_updated_at: new Date().toISOString(),
    })
    .eq("product_id", result.productId);

  if (error) {
    throw new Error(`Failed to persist embedding for product ${result.productId}: ${error.message}`);
  }
}

export async function generateAndPersistProductEmbedding(
  supabase: SupabaseClient<Database>,
  content: ProductEmbeddingContent,
): Promise<ProductEmbeddingGenerationResult> {
  const generated = await generateProductEmbedding(content);
  await persistProductEmbedding(supabase, generated);
  return generated;
}

export async function backfillProductEmbeddings(
  supabase: SupabaseClient<Database>,
  options: ProductEmbeddingBackfillOptions = {},
): Promise<ProductEmbeddingBackfillResult> {
  const batchSize = Math.max(1, Math.min(options.batchSize ?? 20, 200));
  const maxProducts = options.maxProducts;
  const onlyMissing = options.onlyMissing ?? true;

  const result: ProductEmbeddingBackfillResult = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    failures: [],
  };

  let offset = 0;

  while (true) {
    if (typeof maxProducts === "number" && result.processed >= maxProducts) {
      break;
    }

    const remaining =
      typeof maxProducts === "number" ? Math.max(maxProducts - result.processed, 0) : batchSize;
    const currentBatchSize = Math.min(batchSize, remaining || batchSize);

    const rangeStart = onlyMissing ? 0 : offset;
    const rangeEnd = rangeStart + currentBatchSize - 1;

    let query = supabase
      .from("products")
      .select("product_id,name,description,short_description,tags,sku,embedding")
      .order("updated_at", { ascending: false })
      .range(rangeStart, rangeEnd);

    if (onlyMissing) {
      query = query.is("embedding", null);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to load products for embedding backfill: ${error.message}`);
    }

    if (!data || data.length === 0) {
      break;
    }

    for (const row of data) {
      if (typeof maxProducts === "number" && result.processed >= maxProducts) {
        break;
      }

      result.processed += 1;

      try {
        const content = mapProductRowToEmbeddingContent(row);
        await generateAndPersistProductEmbedding(supabase, content);
        result.succeeded += 1;
      } catch (error) {
        result.failed += 1;
        result.failures.push({
          productId: row.product_id,
          reason: error instanceof Error ? error.message : "Unknown embedding generation error",
        });
      }
    }

    if (data.length < currentBatchSize) {
      break;
    }

    if (!onlyMissing) {
      offset += currentBatchSize;
    }
  }

  return result;
}

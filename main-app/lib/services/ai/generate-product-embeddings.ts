import { createClient } from "@supabase/supabase-js";

import {
  backfillProductEmbeddings,
  type ProductEmbeddingBackfillOptions,
  type ProductEmbeddingBackfillResult,
} from "@/lib/services/ai/models/product-embeddings";
import type { Database } from "@/lib/types/database.types";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required to run product embedding generation.`);
  }

  return value;
}

export async function runProductEmbeddingBackfill(
  options: ProductEmbeddingBackfillOptions = {},
): Promise<ProductEmbeddingBackfillResult> {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return backfillProductEmbeddings(supabase, options);
}

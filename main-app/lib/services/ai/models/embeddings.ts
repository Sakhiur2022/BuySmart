import { AIRequestError, AIResponseError } from '@/lib/services/ai/error-handler';
import type { AIEmbeddingResponse } from '@/lib/types/ai.types';

export async function generateEmbedding(input: string): Promise<AIEmbeddingResponse> {
  if (!input.trim()) {
    throw new AIRequestError('Embedding input must be a non-empty string.');
  }

  throw new AIResponseError(
    'Embeddings are currently deferred to Phase 2. Groq free tier does not provide embedding models. ' +
      'For production: use Supabase pgvector with gte-small embeddings, or integrate Hugging Face Embeddings API separately.',
  );

  // TODO: Phase 2 implementation options:
  // 1. Use Supabase pgvector with built-in embedding support
  // 2. Integrate Sentence Transformers API (https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2)
  // 3. Use local embedding model with transformers.js
  // 4. Use OpenAI/Cohere embeddings API (paid)
}

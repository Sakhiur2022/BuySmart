## Hugging Face + LangChain Setup

### Installed dependencies

- `@huggingface/inference`
- `langchain`
- `@langchain/core`
- `@langchain/community`
- `zod`
- `@xenova/transformers`
- `ai`
- `node-fetch`

### Environment variables

Add these keys in `.env.local`:

```dotenv
HUGGINGFACE_API_KEY=your_hf_token_here
HF_LLM_MODEL=mistralai/Mixtral-8x7B-Instruct-v0.1
HF_EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
HF_SENTIMENT_MODEL=cardiffnlp/twitter-roberta-base-sentiment-latest
HF_CHAT_MODEL=meta-llama/Meta-Llama-3-8B-Instruct
HF_CLASSIFICATION_MODEL=facebook/bart-large-mnli

AI_TEMPERATURE=0.7
AI_MAX_TOKENS=1024
AI_TOP_P=0.9

HF_INFERENCE_ENDPOINT=https://api-inference.huggingface.co/models/
HF_RATE_LIMIT_DELAY=100
HF_MAX_RETRIES=3
```

### AI service entry points

- `lib/services/ai/config.ts`
- `lib/services/ai/hf-client.ts`
- `lib/services/ai/langchain-hf.ts`
- `lib/services/ai/models/*`
- `lib/services/ai/test-connection.ts`
- `lib/services/ai/test-models.ts`
- `lib/services/ai/benchmark.ts`

### Quick validation

Use the exported functions from:

- `lib/services/ai/test-connection.ts`
- `lib/services/ai/test-models.ts`
- `lib/services/ai/benchmark.ts`

These validate connectivity, model outputs, and response latency.


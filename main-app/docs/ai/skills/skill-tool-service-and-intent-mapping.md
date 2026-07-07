# Skill: Tool-Service + Intent-Mapping Design (BuySmart / EP-10 pattern)

**When to use:** any ticket that adds a new persona-facing chatbot capability backed by a tool-calling service — e.g. buyer refund tools, seller sales/listing tools, admin moderation tools. Recognizable by tickets under EP-10 (US-104/105/107/108/109) or any `API-0X` ticket pairing "X management tool service + intent mapping."

**Do not auto-load this file.** Paste/reference it only in the specific task prompt that needs it.

---

## Step 0 — one-time distillation cache (fill in ONCE, then never re-read the source files for this)

Do this exactly once, in one dedicated session, before the first ticket that uses this skill. Ask Copilot to inspect **only the exported signatures** (grep for `export`, not full file bodies) of `lib/chatbot/buyer-intent/*` and `lib/services/refund-tools/*`, and paste the distilled result into the table below. From that point on, every future ticket reads this table, not the source files.

| Layer                  | Existing file(s)                                                  | Exported shape (signature only)                                                            | One-line responsibility                                           |
| ---------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| Schema                 | `buyer-intent/schemas.ts`                                         | `buyerIntentSchema`, `buyerIntentSchemasByType`, individual `*Schema` (Zod)                | Define & validate all buyer intent payloads + discriminated union |
| Strategy               | `buyer-intent/strategies.ts`, `buyer-intent/intent-strategies.ts` | `IntentResolutionStrategy<T>`, `createBuyerIntentStrategyRegistry()`                       | Per-intent normalization + post-validation logic                  |
| Registry               | `buyer-intent/registry.ts`                                        | `getBuyerIntentSchemaRegistry()`, `getBuyerIntentSchema(intentType)`                       | intentType → Zod schema lookup                                    |
| Adapter                | `buyer-intent/adapter.ts`                                         | `BuyerIntentPayloadAdapter` (with `toRefund*`, `toRecommendationInput`, `toPolicyQaInput`) | Convert validated intent payload → tool input shape               |
| Facade                 | `buyer-intent/facade.ts`                                          | `BuyerChatToolsFacade` (`resolveIntent`, `buildToolCall`)                                  | Single high-level entry point: resolve + build tool call          |
| Error/events           | `buyer-intent/errors.ts`, `buyer-intent/events.ts`                | `BuyerIntentError`, `BuyerIntentResult<T>`, `IntentValidationEventEmitter`                 | Typed error handling + validation telemetry                       |
| Tool factory/contracts | `buyer-intent/tool-contracts.ts`, `buyer-intent/tool-factory.ts`  | `ToolContract<TInput,TOutput>`, `BuyerIntentToolFactory` (`getTool`, `getToolByName`)      | Declare tool name + input/output Zod schemas for LLM              |
| Tool invocation        | `buyer-intent/tool-invocation.ts`                                 | `invokeBuyerToolCall(toolCall)`                                                            | Execute validated tool with proper error mapping + events         |

**Rule after this table exists:** design work below must cite this table. Do not re-open the source files unless the table genuinely can't answer the question — and if so, open exactly one file, request only the specific function/lines needed, not the whole file or directory.

## Required deliverable shape (design doc, no code) — trimmed to essentials

1. **Intent inventory** — every user intent this feature must handle.
2. **New files** — one line each: name, layer (from the table above), responsibility. No comparison-reading needed — the table already tells you the contract.
3. **Failure modes** — what can fail and which layer owns it.
4. **Wiring point** — which existing route/facade this plugs into, and the (minimal) change there.
5. **Open questions/assumptions.**

Test plan and full contract prose are optional — only include if the ticket explicitly asks for them. Default to the 5 sections above.

## What NOT to do

- Don't re-read `buyer-intent/*` or `refund-tools/*` in full once the distillation table exists — that defeats the entire point.
- Don't put branching intent logic in the facade or the route — that belongs in the registry/strategy layer.
- Don't design a bespoke pattern when the cached table already covers this class of problem.
- Don't write implementation code in this deliverable — design only.
- Don't touch buyer or admin chat routes/tools as part of a seller-scoped ticket.

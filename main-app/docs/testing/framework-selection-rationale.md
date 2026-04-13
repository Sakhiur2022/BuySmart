# Testing Framework Selection Rationale

## Audit-backed constraints

- The codebase is ESM-first with TypeScript `module: esnext` and `moduleResolution: bundler`.
- The app is Next.js 15 App Router with React 19 and server-first route handlers.
- Path alias `@/*` is used throughout the codebase and must resolve in tests.
- Supabase client setup is split across browser, server, and service-role factories.
- AI flows rely on LangChain/Groq model invocation and need deterministic mocks.
- No prior test framework was configured.

## Selected framework set

- Vitest for unit and integration tests.
- Playwright for end-to-end browser tests.

## Why Vitest

- Native ESM support aligns with this project without additional transform layers.
- Minimal setup to honor TypeScript alias resolution.
- Strong mocking API for agent/service/repository/controller boundaries.
- Fast execution for service and API route tests with isolated dependencies.

## Why Playwright

- Best fit for validating App Router user journeys in a real browser context.
- Straightforward local/CI startup integration through `webServer`.
- Good signal for buyer/seller/auth flows where route groups and middleware matter.

## Alternatives considered and rejected

### Jest + ts-jest

Rejected for this codebase because:

- Higher ESM friction in an `esnext` + bundler-resolution project.
- More transform and interop setup complexity for Next 15 App Router modules.
- Lower implementation speed relative to Vitest for the current architecture.

### Jest + Babel/SWC transform

Rejected for this codebase because:

- Adds additional transform stack and maintenance overhead.
- More brittle in mixed server/client import boundaries.
- No practical advantage over Vitest for current unit/integration goals.

### Playwright-only strategy

Rejected for this codebase because:

- E2E alone cannot replace fast deterministic unit/integration coverage.
- Service/repository/agent logic would become expensive and flaky to validate exclusively in browser tests.

## Coverage priorities set from architecture risk

1. Unit tests:

- `lib/agents/*`
- `lib/services/*`
- `lib/repositories/*`
- `lib/controllers/*`

2. Integration tests:

- `app/api/*` route handlers with auth/request helper patterns and mocked external dependencies.

3. End-to-end tests:

- Cart sync, checkout/order creation, feedback sentiment analysis, recommendation request flow.

## Implementation boundaries

- Only devDependencies were added.
- Runtime app behavior and production configuration were not changed.
- Mocks are utility-level, preserving business logic assertions in test targets.

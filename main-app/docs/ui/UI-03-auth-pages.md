# UI-03 — Authentication Pages

**Sprint:** 2 | **Status:** ✅ Complete | **Owner:** ASR

---

## Section 1 — Implementation Summary

### Overview

UI-03 implements the complete set of user-facing authentication pages — login, registration, password reset, OAuth callback, and confirmation screens. All auth pages share a dedicated branded layout with a minimal header and footer, keeping the user focused on the authentication flow without the full application shell. The implementation wires directly into the existing Supabase Auth system established in Sprint 1.

### What Was Built

**Auth Layout:**

- `AuthLayout` — A lightweight page wrapper used exclusively for all `/auth/*` routes. Contains a slim branded header (BuySmart logo + link home) and a one-line course footer. The main content area centers its children both vertically and horizontally with a subtle `bg-muted/30` background.

**Auth Pages (route group `app/(auth)/auth/`):**

- **Login page** (`/auth/login`) — Renders `LoginForm` inside the auth layout. The form presents Google and Facebook OAuth sign-in buttons via the shared `OAuthProviderButtons` component.
- **Sign-up page** (`/auth/sign-up`) — Renders `SignUpForm` with the same OAuth buttons plus a "Already have an account? Login" link.
- **Forgot password page** (`/auth/forgot-password`) — Renders `ForgotPasswordForm` for email-based password reset initiation.
- **Update password page** (`/auth/update-password`) — Renders `UpdatePasswordForm` for setting a new password after reset.
- **Sign-up success page** (`/auth/sign-up-success`) — Confirmation screen shown after OAuth sign-up.
- **Confirm page** (`/auth/confirm`) — Handles email confirmation tokens via Supabase.
- **OAuth callback page** (`/auth/oauth`) — Processes the OAuth redirect from Google/Facebook.
- **Error page** (`/auth/error`) — Displays auth error messages in a user-friendly format.
- **Logout page** (`/auth/logout`) — Performs server-side Supabase sign-out and redirects.

**Form Components (`components/forms/`):**

- `LoginForm` — Card-based form with `OAuthProviderButtons`, used on the login page.
- `SignUpForm` — Card-based form with `OAuthProviderButtons` and a login redirect link.
- `ForgotPasswordForm` — Email input with submit trigger for password reset.
- `UpdatePasswordForm` — New password + confirm fields for post-reset update.

**Auth Support Components (`app/(auth)/components/`):**

- `OAuthProviderButtons` — Renders one `Button` per OAuth provider (Google, Facebook), handles loading state, provider-specific redirect, and error display.
- `AuthErrorDisplay` — Inline error message component for auth failures.
- `AuthLoading` — Loading indicator shown during OAuth redirect.

### Affected Files

```
main-app/app/(auth)/auth/layout.tsx              → CREATED; branded auth layout (slim header + centered content + footer)
main-app/app/(auth)/auth/login/page.tsx          → MODIFIED; removed wrapper div (layout now handles centering)
main-app/app/(auth)/auth/sign-up/page.tsx        → MODIFIED; removed wrapper div (layout now handles centering)
main-app/app/(auth)/auth/forgot-password/        → Pre-existing; page renders ForgotPasswordForm
main-app/app/(auth)/auth/update-password/        → Pre-existing; page renders UpdatePasswordForm
main-app/app/(auth)/auth/sign-up-success/        → Pre-existing; confirmation screen
main-app/app/(auth)/auth/confirm/                → Pre-existing; Supabase email confirm token handler
main-app/app/(auth)/auth/oauth/                  → Pre-existing; OAuth callback handler
main-app/app/(auth)/auth/error/                  → Pre-existing; auth error display page
main-app/app/(auth)/auth/logout/                 → Pre-existing; server-side sign-out handler
main-app/components/forms/login-form.tsx         → Pre-existing; OAuth login card form
main-app/components/forms/sign-up-form.tsx       → Pre-existing; OAuth sign-up card form
main-app/components/forms/forgot-password-form.tsx → Pre-existing; email reset form
main-app/components/forms/update-password-form.tsx → Pre-existing; new password form
main-app/app/(auth)/components/oauth-provider-buttons.tsx → Pre-existing; provider button list
main-app/app/(auth)/components/auth-error-display.tsx     → Pre-existing; inline error message
main-app/app/(auth)/components/auth-loading.tsx           → Pre-existing; loading indicator
main-app/app/(auth)/lib/auth-providers.ts                 → Pre-existing; OAuth provider config array
main-app/app/(auth)/hooks/use-auth-redirect.ts            → Pre-existing; next-path query param hook
main-app/app/(auth)/hooks/use-oauth-login.ts              → Pre-existing; OAuth sign-in handler hook
```

### Key Design Decisions

- **Dedicated auth layout** — Auth pages intentionally do not use the main application `Navbar` + `Footer` shell. A distraction-free layout keeps users focused during sign-in/sign-up and avoids showing navigation links that require authentication to be meaningful.
- **OAuth-only authentication** — By design, the platform uses Google and Facebook OAuth exclusively (no email/password form). This simplifies the auth surface, eliminates password storage concerns, and leverages Supabase's built-in OAuth provider support.
- **`OAuthProviderButtons` is provider-config-driven** — The list of OAuth providers comes from `app/(auth)/lib/auth-providers.ts`. Adding a new provider (e.g., GitHub) requires only adding an entry to that config array — no JSX changes needed.
- **`next` query param for post-login redirect** — After a successful login, users are redirected to the path stored in the `?next=` query parameter (defaulting to `/protected`). This is handled by `use-auth-redirect.ts`.
- **Layout handles centering, pages stay minimal** — Previously, each auth page had its own centering wrapper div. This logic is now consolidated in `AuthLayout`, keeping individual page files to 5–6 lines each.
- **Supabase SSR-compatible cookies** — Auth state is managed via `@supabase/ssr` server-side client, ensuring cookies are set with `httpOnly`, `secure` (in production), and `strictSameSite` flags.

### Dependencies & Libraries Used

| Package                  | Purpose                                                  |
| :----------------------- | :------------------------------------------------------- |
| `@supabase/ssr`          | Server-side Supabase auth client (cookie-based sessions) |
| `@supabase/supabase-js`  | Client-side auth operations (OAuth sign-in)              |
| `next/navigation`        | `redirect()` for server-side redirects post-login        |
| `next/link`              | Auth page cross-links ("Already have an account?")       |
| `lucide-react`           | `ShoppingBag` icon in auth layout header                 |
| `@/components/ui/button` | OAuth provider buttons                                   |
| `@/components/ui/card`   | Form card wrapper (CardHeader, CardContent, etc.)        |

---

## Section 2 — Modification Guide

### How to Add a New OAuth Provider

1. Enable the provider in your **Supabase dashboard** under Authentication → Providers.
2. Open `main-app/app/(auth)/lib/auth-providers.ts` and add an entry:
   ```ts
   export const OAUTH_PROVIDERS = [
     { id: "google", label: "Continue with Google" },
     { id: "facebook", label: "Continue with Facebook" },
     { id: "github", label: "Continue with GitHub" }, // ← add this
   ];
   ```
3. That's it. `OAuthProviderButtons` renders the array automatically — no JSX changes needed.

### How to Add a New Auth Page

1. Create a new directory inside `main-app/app/(auth)/auth/`, e.g., `verify-phone/`.
2. Create a `page.tsx` inside it:

   ```tsx
   import { MyVerifyForm } from "@/components/forms/verify-phone-form";

   export default function Page() {
     return (
       <div className="w-full max-w-sm">
         <MyVerifyForm />
       </div>
     );
   }
   ```

3. The page automatically inherits `AuthLayout` (slim header + centered + footer) because it's inside the `(auth)/auth/` directory which has `layout.tsx`.
4. Create the corresponding form component in `components/forms/`.

### How to Modify the Auth Layout

- **Change the header height:** Modify `h-14` on the `<header>` in `app/(auth)/auth/layout.tsx`.
- **Change the background:** Modify `bg-muted/30` on `<main>` in the same file.
- **Add links to the header:** Add `<Link>` elements after the brand logo inside the `<header>`.
- **Change the footer text:** Modify the content of the `<footer>` element.
- **Make the content wider:** Change `max-w-sm` on the wrapping div inside each page component (not in the layout — the layout provides the full-width center; the page constrains its own content width).

### How to Change the Post-Login Redirect

- The default redirect is `/protected`. It is set as the `defaultNextPath` prop on `OAuthProviderButtons`.
- To change it for a specific page:
  ```tsx
  <OAuthProviderButtons defaultNextPath="/seller" />
  ```
- The path can also be overridden at runtime via `?next=/some-path` in the URL — `use-auth-redirect.ts` reads this query parameter first.

### Where NOT to Touch

- **`app/(auth)/auth/confirm/page.tsx`** — This handles Supabase email confirmation tokens. It must remain a server component that calls `supabase.auth.exchangeCodeForSession()`. Do not convert it to a client component.
- **`app/(auth)/auth/oauth/page.tsx`** — Handles the OAuth provider callback. Modifying the redirect logic here can break the entire OAuth flow. Change only if you fully understand the PKCE/implicit flow.
- **Cookie configuration in `lib/supabase/server.ts`** — The `httpOnly`, `secure`, and `sameSite` cookie flags on the server client are security-critical. Do not relax them.
- **`use-oauth-login.ts` hook** — This hook handles the Supabase `signInWithOAuth` call, loading state, and error handling. If you need to customize provider behavior, extend this hook rather than inlining the logic into a component.

### Common Pitfalls

- **Missing `?next=` handling** — If you link to `/auth/login` without a `?next=` param, users will be redirected to `/protected` after login (the default). Make sure any "Login required" redirect in the app appends `?next=<current-path>` so users return to where they were.
- **Auth layout vs. app layout** — Auth pages are inside `(auth)/auth/layout.tsx`, which does NOT include the Navbar. If you accidentally place a new auth page outside this directory (e.g., directly in `app/auth-test/`), it will use the root layout and the Navbar will appear.
- **`Suspense` on `OAuthProviderButtons`** — The buttons component reads a URL search param via `useSearchParams()`, which requires `Suspense` in Next.js App Router. Do not remove the `<Suspense>` wrapper in `LoginForm` and `SignUpForm`.
- **Supabase redirect URLs** — After OAuth sign-in, Supabase redirects to the `redirectTo` URL set in `use-oauth-login.ts`. This URL must be whitelisted in **Supabase Dashboard → Authentication → URL Configuration → Redirect URLs**. Unwhitelisted URLs will cause an OAuth error.
- **`window.localStorage` guard** — The Supabase client in `lib/supabase/client.ts` guards `localStorage` with `typeof window !== 'undefined'`. Do not remove this — it prevents SSR crashes.

### Testing Checklist

- [ ] `/auth/login` renders the login form centered with the branded header
- [ ] `/auth/sign-up` renders the sign-up form with a "Login" cross-link
- [ ] Clicking a provider button (Google/Facebook) initiates the OAuth redirect without errors
- [ ] After successful OAuth login, user is redirected to `/protected` (or the `?next=` path)
- [ ] After logout, user is redirected to `/` or `/auth/login`
- [ ] Auth pages do NOT show the main application Navbar or Footer
- [ ] Auth layout header logo links back to `/`
- [ ] `/auth/forgot-password` renders the forgot password form
- [ ] `/auth/update-password` is only accessible with a valid reset token
- [ ] Error states (invalid token, provider error) render `AuthErrorDisplay` with a readable message
- [ ] Run `npm run lint` and `npx tsc --noEmit` with no errors
- [ ] Test in both light and dark mode

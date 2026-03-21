# AI-07-FIX-01 — Runtime & Build Error Fixes

**Date:** 2026-03-13  
**Developer:** Senior Web Developer (Next.js / Supabase)  
**Scope:** `main-app`

---

## Fix 1 — Invalid UTF-8 Sequence (Build / Tailwind v4 oxide scanner)

**File:** `components/shared/tutorial/fetch-data-steps.tsx`

**Error:**

```
Error: Invalid UTF-8 sequence
```

**Root Cause:**  
Tailwind v4 uses a Rust-based "oxide" CSS scanner that reads every source file as raw bytes. The raw 🚀 emoji is a 4-byte UTF-8 sequence (`0xF0 0x9F 0x9A 0x80`). The Rust parser choked on it and threw before the dev server could compile.

**Fix:**  
Replaced the literal emoji character with a JSX JavaScript Unicode escape so the source file contains only ASCII-safe bytes:

```diff
- <p>You&apos;re ready to launch your product to the world! 🚀</p>
+ <p>You&apos;re ready to launch your product to the world! {'\u{1F680}'}</p>
```

---

## Fix 2 — Invalid UTF-8 Sequence (Runtime / Supabase SSR cookie decoding)

**Files:**

- `lib/supabase/server.ts`
- `middleware.ts`

**Error:**

```
Error: Invalid UTF-8 sequence
  at stringFromUTF8 (node_modules/@supabase/ssr/dist/module/utils/base64url.js)
  at stringFromBase64URL (...)
  at Object.getItem (node_modules/@supabase/ssr/dist/module/cookies.js)
  at async SupabaseAuthClient.__loadSession (...)
```

**Root Cause:**  
`@supabase/ssr` reads `sb-*` auth cookies and base64url-decodes them on every request. The browser was sending a stale or malformed cookie from a previous session whose decoded bytes were not valid UTF-8. The `TextDecoder` inside the SSR package used `{ fatal: true }`, which throws instead of returning a replacement character, crashing the entire request.

**Fix:**  
Added a validation filter inside `getAll()` in both the server client and middleware. Any `sb-*` cookie whose base64url-decoded value is not valid UTF-8 is silently dropped, causing the library to return a `null` session (user treated as signed out) instead of throwing:

```ts
getAll() {
  return cookieStore.getAll().filter(({ name, value }) => {
    if (!name.startsWith('sb-')) return true;
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(
        Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64'),
      );
      return true;
    } catch {
      return false; // discard corrupted auth cookie, treat user as signed out
    }
  });
},
```

**Additional manual step required:**  
Clear the corrupted `sb-*` cookie from the browser:  
DevTools → Application → Cookies → `localhost` → delete any `sb-*` entry → refresh.

---

## Fix 3 — React Hydration Mismatch (Grammarly browser extension)

**File:** `app/layout.tsx`

**Error:**

```
A tree hydrated but some attributes of the server rendered HTML didn't match the client properties.
  - data-new-gr-c-s-check-loaded="14.1134.0"
  - data-gr-ext-installed=""
```

**Root Cause:**  
The Grammarly browser extension injects `data-new-gr-c-s-check-loaded` and `data-gr-ext-installed` attributes directly onto `<body>` before React hydrates. React sees a mismatch between the server-rendered HTML (no extra attributes) and the client DOM (extra attributes added by the extension) and logs a hydration error.

**Fix:**  
Added `suppressHydrationWarning` to the `<body>` element, matching the existing usage on `<html>`. This tells React to skip attribute-level diffing on that specific element without affecting child component warnings:

```diff
- <body className={`${geistSans.className} antialiased`}>
+ <body className={`${geistSans.className} antialiased`} suppressHydrationWarning>
```

---

## Summary

| #   | File                                      | Error Type                         | Cause                                | Fix                                        |
| --- | ----------------------------------------- | ---------------------------------- | ------------------------------------ | ------------------------------------------ |
| 1   | `fetch-data-steps.tsx`                    | Build — Tailwind oxide scanner     | Raw 4-byte emoji in source           | Replace with `{'\u{1F680}'}`               |
| 2   | `lib/supabase/server.ts`, `middleware.ts` | Runtime — SSR cookie decode        | Stale/corrupted `sb-*` auth cookie   | Filter invalid cookies in `getAll()`       |
| 3   | `app/layout.tsx`                          | Console — React hydration mismatch | Grammarly extension mutates `<body>` | Add `suppressHydrationWarning` to `<body>` |

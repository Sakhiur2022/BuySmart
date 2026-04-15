# Seller auth redirection fix

## Summary
This change set fixes seller upgrade and redirection issues by moving role changes and profile hydration to server endpoints that can read Supabase auth cookies reliably.

## Problem
- Client-side Supabase session was often missing even when a user was logged in.
- The seller upgrade CTA redirected to sign-up or showed errors instead of upgrading.
- Sellers still saw the "Sign up as a seller" CTA due to missing role hydration on the home page.

## How it works now
### Logged-in buyer
1. User clicks "Sign up as a seller" on the home page.
2. Confirmation dialog appears.
3. User clicks Continue.
4. Client calls POST /api/seller/upgrade.
5. Server reads cookie-backed session, resolves user id, updates users_profile role to seller, updates auth metadata.
6. Client redirects to /seller.

### Logged-in seller
1. Home page hydration calls GET /api/auth/me.
2. Server returns role = seller.
3. CTA is hidden on the home page.
4. If the user somehow triggers the upgrade API, it returns ok without changing role.

### Not logged in
1. User clicks "Sign up as a seller" on the home page.
2. Confirmation dialog appears.
3. User clicks Continue.
4. Client calls POST /api/seller/upgrade.
5. Server sees no session and returns 401.
6. Client redirects to /auth/seller-sign-up.

### Admin or moderator
1. Client calls POST /api/seller/upgrade.
2. Server rejects with a 403 and error code admin_or_moderator.
3. Client redirects to /.

## Fixes applied
1. Added a server-side upgrade endpoint to handle role changes using cookie-backed auth.
2. Updated the seller upgrade CTA to call the server endpoint instead of client-side auth.
3. Added a server-side profile endpoint to hydrate the home page role reliably.
4. Updated home page user hydration to use the server profile endpoint.
5. Adjusted CTA visibility to hide for sellers once role is correctly hydrated.

## Files changed
- app/api/seller/upgrade/route.ts
- app/api/auth/me/route.ts
- components/shared/seller-upgrade-cta.tsx
- app/page.tsx

## Validation checklist
- Logged-in buyer: Continue upgrades role to seller and redirects to /seller.
- Logged-in seller: CTA not visible on home page.
- Not logged in: Continue redirects to /auth/seller-sign-up.
- Admin or moderator: Continue redirects to /.

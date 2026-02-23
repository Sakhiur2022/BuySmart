# Auth-02 Auth-03: Authentication Module Architecture

## 1. GitHub OAuth Removal Plan

### UI Layer Changes

- Remove GitHub provider button from `/login/page.tsx` and `/sign-up/page.tsx`
- Clean up any GitHub-specific styling or icons
- Update provider selection to show only Google and Facebook options

### Configuration Cleanup

- Remove GitHub provider from Supabase client OAuth configuration
- Clean up any GitHub-specific provider arrays or constants

### Backend References

- Remove GitHub OAuth handling from `/oauth/route.ts` callback
- Clean up any GitHub-specific user profile mapping logic
- Remove GitHub provider validation from auth utilities

### Session Logic Impact

- Remove GitHub-specific metadata handling
- Ensure provider-agnostic session management
- Clean up any GitHub provider checks in auth flows

## 2. Frontend OAuth Integration Plan

### Current State Assessment

- **Backend:** Google + Facebook OAuth configured in Supabase
- **Frontend:** Needs complete OAuth implementation
- **GitHub:** Present but needs removal

### OAuth Flow Architecture

```
Provider Selection → Supabase signInWithOAuth() → Provider Auth → Callback → Session Creation → App Redirect
```

### Integration Strategy

- **Supabase Auth:** Use `@supabase/auth-helpers-nextjs` for OAuth flows
- **Provider Config:** Configure Google and Facebook in Supabase client
- **Callback Handling:** Unified OAuth callback processing
- **Error Recovery:** Handle OAuth failures gracefully

## 3. File Structure Design

### Updated Structure

```
(auth)/
├── auth/
│   ├── login/page.tsx              # OAuth provider selection only
│   ├── sign-up/page.tsx            # Same OAuth flow as login
│   ├── oauth/route.ts              # OAuth callback handler
│   ├── error/page.tsx              # OAuth error handling
│   └── logout/route.ts             # Session cleanup
├── components/
│   ├── oauth-provider-buttons.tsx  # Google + Facebook buttons
│   ├── auth-loading.tsx            # OAuth loading states
│   └── auth-error-display.tsx      # Error UI component
├── hooks/
│   ├── use-oauth-login.ts          # OAuth flow management
│   ├── use-auth-session.ts         # Session state management
│   └── use-auth-redirect.ts        # Post-auth navigation
├── lib/
│   ├── supabase-auth.ts            # Supabase OAuth configuration
│   ├── auth-providers.ts           # Provider definitions
│   └── auth-utils.ts               # Helper functions
└── types/
    └── auth.ts                     # Auth type definitions
```

### Component Responsibilities

- **Pages:** OAuth initiation and callback handling
- **Components:** Reusable OAuth UI elements
- **Hooks:** OAuth business logic and state management
- **Lib:** Supabase configuration and utilities

## 4. OAuth Implementation Architecture

### Provider Configuration

```typescript
// Supabase OAuth providers setup
const providers = {
  google: {
    redirectTo: `${origin}/auth/oauth`,
    options: { queryParams: { access_type: "offline", prompt: "consent" } },
  },
  facebook: {
    redirectTo: `${origin}/auth/oauth`,
    options: { scopes: "email" },
  },
};
```

### Session Management Strategy

- **Server Components:** Use `createServerComponentClient` for SSR
- **Client Components:** Use `createClientComponentClient` for CSR
- **Middleware:** Route protection with `createMiddlewareClient`
- **State Sync:** Real-time auth state updates across components

### Error Handling Framework

- **OAuth Errors:** Provider-specific error messaging
- **Network Failures:** Retry mechanisms with exponential backoff
- **Session Errors:** Automatic session refresh attempts
- **Fallback UI:** Graceful degradation for auth failures

## 5. Security Implementation

### OAuth Security Measures

- **PKCE:** Automatically handled by Supabase Auth
- **State Validation:** Built-in CSRF protection
- **Redirect URI Validation:** Configured in Supabase Dashboard
- **Secure Cookies:** httpOnly session cookies

### Token Management

- **Access Tokens:** Short-lived, automatically refreshed
- **Refresh Tokens:** Secure storage in httpOnly cookies
- **Session Persistence:** Supabase handles token lifecycle
- **Logout Cleanup:** Complete session termination

## 6. Implementation Phases

### Phase 1: GitHub Removal (1-2 hours)

1. Remove GitHub UI elements from login/signup pages
2. Clean GitHub references from OAuth route handler
3. Remove GitHub environment variables
4. Test existing auth flows remain functional

### Phase 2: OAuth Foundation (2-3 hours)

1. Configure Supabase client with Google/Facebook providers
2. Create OAuth provider button components
3. Implement basic OAuth initiation flow
4. Set up OAuth callback handling

### Phase 3: Session Integration (2-4 hours)

1. Implement session management hooks
2. Create auth middleware for route protection
3. Add session persistence and restoration
4. Implement logout functionality

### Phase 4: Error Handling & Polish (1-2 hours)

1. Add comprehensive error handling
2. Implement loading states for OAuth flows
3. Add user feedback for auth states
4. Test complete auth journey

### Phase 5: Testing & Optimization (1-2 hours)

1. Test OAuth flows with both providers
2. Verify session persistence across browser sessions
3. Test route protection and redirects
4. Performance optimization and cleanup

## 7. Technical Specifications

### Environment Variables Required

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### Supabase Configuration

- **Google OAuth:** Already configured in Supabase backend
- **Facebook OAuth:** Already configured in Supabase backend
- **Redirect URLs:** Configure in Supabase Dashboard
- **Provider Settings:** Verify scopes and permissions

### Route Protection Strategy

- **Public Routes:** `/`, `/auth/*`, `/about`, etc.
- **Protected Routes:** `/dashboard/*`, `/profile/*`, etc.
- **Conditional Routes:** Market-specific access controls
- **Fallback Behavior:** Redirect to login with return URL

## 8. Integration Checkpoints

### Pre-Implementation Verification

- [ ] Confirm Google OAuth config in Supabase Dashboard
- [ ] Confirm Facebook OAuth config in Supabase Dashboard
- [ ] Verify redirect URLs are properly configured
- [ ] Test backend OAuth endpoints are responding

### Post-Implementation Testing

- [ ] Google OAuth complete flow test
- [ ] Facebook OAuth complete flow test
- [ ] Session persistence across browser restart
- [ ] Route protection working correctly
- [ ] Logout clears all auth state
- [ ] Error handling displays appropriate messages

### Production Readiness

- [ ] OAuth providers configured for production domains
- [ ] Security headers implemented
- [ ] Error monitoring integrated
- [ ] Performance metrics established

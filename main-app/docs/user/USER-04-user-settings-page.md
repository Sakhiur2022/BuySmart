# USER-04: User Settings Page

## 1. Feature Overview

- **Feature ID**: USER-04
- **Feature Name**: User Settings Page
- **Type**: New Feature
- **Status**: Completed
- **Route**: `/profile/settings` (under `(buyer)` layout group)
- **Access**: Authenticated users only (redirects to `/auth/login` if unauthenticated)
- **Description**: The settings page lets users manage preferences (theme, timezone, notifications), privacy visibility, and security (password change). It shows account metadata such as email, role, verification status, last updated, and user ID.

---

## 2. User Stories Covered

- As an authenticated user, I can view my account email, role, verification status, last updated timestamp, and user ID
- As a user, I can update theme and timezone preferences
- As a user, I can toggle email notifications, product alerts, and marketing emails
- As a user, I can control public profile visibility
- As a user, I receive inline feedback when preferences save successfully or fail
- As a user, I can update my password with confirmation and validation
- As a user, I see validation hints when my password is too short or does not match
- As a user, success and error messages auto-dismiss after a short delay

---

## 3. Feature Architecture

### 3a. Route and File Structure

```
app/
├── (buyer)/
│   └── profile/
│       └── settings/
│           └── page.tsx                -> Server Component that fetches user + preferences
components/
├── forms/
│   └── user-settings-form.tsx          -> Client Component for tabs, forms, toggles, dialog
lib/
├── actions/
│   └── settings.ts                     -> Server action to save preferences
├── supabase/
│   ├── client.ts                       -> Client-side Supabase instance
│   └── server.ts                       -> Server-side Supabase instance
```

### 3b. Data Flow

```
1. page.tsx            -> Creates server Supabase client
2. page.tsx            -> Fetches authenticated user; redirects if missing
3. page.tsx            -> Reads users_profile (role, email_verified, preferences, updated_at)
4. page.tsx            -> Merges profile preferences with auth metadata fallback
5. page.tsx            -> Passes initialPreferences to UserSettingsForm
6. Form                -> User changes preferences and submits
7. savePreferences     -> Server action updates users_profile.preferences + updated_at
8. savePreferences     -> Attempts to sync auth metadata (non-blocking)
9. Form                -> Sets success or error message and refreshes router
10. Security tab       -> Password submit opens confirmation dialog
11. Confirm update     -> Client Supabase auth.updateUser({ password })
12. Form               -> Shows success or error message
```

### 3c. Component Breakdown

#### page.tsx -> Server Component

- **File**: `app/(buyer)/profile/settings/page.tsx`
- **Type**: Server Component
- **Props**: None
- **Responsibilities**: Auth checks, profile fetch, merges preferences from profile + metadata, renders settings form.

#### UserSettingsForm -> Client Component

- **File**: `components/forms/user-settings-form.tsx`
- **Type**: Client Component (`'use client'`)
- **Props**:
  ```ts
  userId: string;
  email: string;
  role: string;
  emailVerified: boolean;
  hasProfileRecord: boolean;
  initialUpdatedAt: string | null;
  initialPreferences: {
    emailNotifications: boolean;
    productAlerts: boolean;
    marketingEmails: boolean;
    publicProfile: boolean;
    theme: 'system' | 'light' | 'dark';
    timezone: string;
  };
  ```
- **Responsibilities**: Manages tabs, form state, toggles, confirmation dialog, save flows, and feedback states.
- **State Variables**:
  ```ts
  const [currentTab, setCurrentTab];
  const [preferences, setPreferences];
  const [updatedAt, setUpdatedAt];
  const [isSavingPreferences, setIsSavingPreferences];
  const [preferencesError, setPreferencesError];
  const [preferencesSuccess, setPreferencesSuccess];
  const [password, setPassword];
  const [confirmPassword, setConfirmPassword];
  const [isUpdatingPassword, setIsUpdatingPassword];
  const [isConfirmDialogOpen, setIsConfirmDialogOpen];
  const [passwordError, setPasswordError];
  const [passwordSuccess, setPasswordSuccess];
  ```

---

## 4. Form Fields

### Preferences and Privacy

| Field | Type | Values | Saved To | Notes |
| --- | --- | --- | --- | --- |
| Theme | Select | system, light, dark | users_profile.preferences.theme + auth metadata | Applied immediately via `setTheme` |
| Timezone | Select | 6 predefined timezones | users_profile.preferences.timezone + auth metadata | Validated against allowlist |
| Email notifications | Toggle | boolean | users_profile.preferences.emailNotifications + auth metadata | Defaults to true if missing |
| Product alerts | Toggle | boolean | users_profile.preferences.productAlerts + auth metadata | Defaults to true if missing |
| Marketing emails | Toggle | boolean | users_profile.preferences.marketingEmails + auth metadata | Defaults to false if missing |
| Public profile | Toggle | boolean | users_profile.preferences.publicProfile + auth metadata | Defaults to false if missing |

### Security

| Field | Type | Validation | Saved To | Notes |
| --- | --- | --- | --- | --- |
| New password | Password input | min 8 chars | Supabase auth user | Requires confirmation dialog |
| Confirm password | Password input | must match | Supabase auth user | Inline mismatch hint shown |

---

## 5. Confirmation Dialog

### Trigger Behavior

Dialog opens when the user submits the Security tab form and all validations pass:

1. Password length is at least 8
2. Confirmation is not empty
3. Password and confirmation match

### Dialog Content

- **Title**: "Confirm password change"
- **Description**: "This will update your account password. Make sure you remember it."
- **Buttons**:
  - Cancel (outline, closes dialog)
  - Confirm update (executes `auth.updateUser`)

---

## 6. Loading and Feedback States

| State | Trigger | Where Shown | UI Displayed | Duration |
| --- | --- | --- | --- | --- |
| Saving preferences | Preferences or Privacy submit | Preferences/Privacy tab | Button text "Saving..." | Until save completes |
| Preferences success | Save succeeds | Preferences/Privacy tab | Inline success text in green | Auto-dismiss after 3000ms |
| Preferences error | Save fails | Preferences/Privacy tab | Inline error text in red | Auto-dismiss after 3000ms |
| Password too short | Password length < 8 | Security tab | Inline hint in amber | Until length valid |
| Password mismatch | Passwords differ | Security tab | Inline hint in amber | Until match |
| Updating password | Confirm update click | Security tab | Button text "Updating..." | Until update completes |
| Password success | Update succeeds | Security tab | Inline success text in green | Auto-dismiss after 3000ms |
| Password error | Update fails | Security tab | Inline error text in red | Auto-dismiss after 3000ms |
| Missing profile record | No profile row | Preferences/Privacy tab | Banner warning message | Persistent |

---

## 7. Affected Files

| File | Status | Purpose |
| --- | --- | --- |
| `app/(buyer)/profile/settings/page.tsx` | Created | Server page that loads user + preferences and renders the settings form |
| `components/forms/user-settings-form.tsx` | Created | Client form with tabs, toggles, validation, and dialog |
| `lib/actions/settings.ts` | Created | Server action to persist preferences and metadata |
| `lib/supabase/client.ts` | Existing | Client-side Supabase auth for password updates |
| `lib/supabase/server.ts` | Existing | Server-side Supabase auth for page data |

---

## 8. Supabase Integration

### Tables and Columns

**users_profile** (Read + Write)

- Read columns: `role`, `email_verified`, `preferences`, `updated_at`
- Write columns: `preferences`, `updated_at`

### Auth Metadata

`savePreferences` syncs these keys to auth metadata (non-blocking):

- `email_notifications`
- `product_alerts`
- `marketing_emails`
- `public_profile`
- `theme_preference`
- `timezone`

### Auth Operations

- Page load: `supabase.auth.getUser()` on the server
- Password update: `supabase.auth.updateUser({ password })` on the client

---

## 9. Animation Summary

| Element | Animation | Duration | Library | Config |
| --- | --- | --- | --- | --- |
| Card container | Fade + translate Y 14 -> 0 | 450ms | Framer Motion | `cardMotion` with easeOut |
| Tab panel | Fade + translate Y 10 -> 0 | 250ms | Framer Motion | `panelMotion` with easeOut |

---

## 10. How to Modify

### Adding a New Preference Toggle

**Step 1**: Extend the preferences type in both files

```ts
// app/(buyer)/profile/settings/page.tsx
type UserSettingsPreferences = {
  // ...existing fields
  newPreference: boolean;
};

// components/forms/user-settings-form.tsx
type UserSettingsPreferences = {
  // ...existing fields
  newPreference: boolean;
};
```

**Step 2**: Add a default value in `initialPreferences`

```ts
const initialPreferences: UserSettingsPreferences = {
  // ...existing fields
  newPreference: readBoolean(profilePreferences.newPreference, false),
};
```

**Step 3**: Add the toggle UI and update state

```tsx
<ToggleSwitch
  id="newPreference"
  checked={preferences.newPreference}
  onCheckedChange={(checked) =>
    setPreferences((prev) => ({
      ...prev,
      newPreference: checked,
    }))
  }
/>
```

**Step 4**: Update the server action to persist metadata

```ts
await supabase.auth.updateUser({
  data: {
    // ...existing metadata
    new_preference: preferences.newPreference,
  },
});
```

**Step 5**: Update this documentation (Form Fields, Data Flow, and Supabase Integration)

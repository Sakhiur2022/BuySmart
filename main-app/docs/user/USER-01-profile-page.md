# USER-01: User Profile Page

## 1. Feature Overview

- **Feature ID**: USER-01
- **Feature Name**: User Profile Page
- **Type**: New Feature
- **Status**: Completed
- **Route**: `/profile` (under `(buyer)` layout group)
- **Access**: Authenticated users only (redirects to `/auth/login` if unauthenticated)
- **Description**: The profile page enables authenticated users to view and edit their profile information including full name, display name, phone number, and avatar URL. Users must confirm changes before saving, with real-time validation, loading states, and comprehensive error handling. Email verification is required before profile editing is allowed.

---

## 2. User Stories Covered

- As an authenticated user, I can view my current profile information
- As an authenticated user, I can edit my full name, display name, phone number, and avatar URL
- As a user with an unverified email, I cannot edit my profile and see a verification prompt
- As a user, I can click "Save changes" to open a confirmation dialog showing my edits
- As a user, I see a summary of changes before confirming the save
- As a user, clicking "Confirm" triggers a loading state with "Saving..." and a spinner
- As a user, upon successful save, I see "Saved!" briefly before the dialog closes
- As a user, if the save fails, I see an error message and can retry
- As a user, I can cancel changes and return to viewing mode without losing data
- As a user with reduced motion preferences, animations are replaced with fade-only transitions

---

## 3. Feature Architecture

### 3a. Route & File Structure

```
app/
├── (buyer)/
│   └── profile/
│       └── page.tsx              → Server Component — fetches user profile data and renders form
components/
├── forms/
│   └── user-profile-form.tsx     → Client Component — handles form state, editing, dialog, and save logic
lib/
├── animations.ts                 → Centralized Framer Motion variants (used by form)
├── supabase/
│   ├── client.ts                 → Client-side Supabase instance
│   └── server.ts                 → Server-side Supabase instance (used in page.tsx)
```

### 3b. Data Flow

```
1. page.tsx            → Fetches user object from Supabase Auth session
2. page.tsx            → Queries users_profile table for existing profile data
3. page.tsx            → Merges database profile + auth user metadata for initial state
4. page.tsx            → Passes userId, email, initialProfile to UserProfileForm
5. Form               → User views profile in read-only mode initially
6. Edit button        → User clicks edit button to enable form fields
7. Field changes      → User modifies any of 4 form fields
8. Save button        → User clicks "Save changes" button
9. Form validation    → Phone field is validated; validation errors shown inline
10. Dialog opens       → Confirmation dialog displays, showing summary of changes
11. Confirm button     → User clicks "Confirm" to proceed with save
12. Saving state       → Button shows "Saving..." + spinner (disabled, prevents double-click)
13. Supabase update    → Creates client-side Supabase instance
14. Record check       → If hasProfileRecord=true, UPDATE; else INSERT new record
15. Save result        → On success: profile data saved, auth metadata updated, page refreshed
16. Success state      → Button shows "Saved!" for 1500ms
17. Dialog close       → After 1500ms, dialog closes automatically
18. Reset state        → Form returns to read-only mode; user can edit again or navigate away
19. Error path         → If save fails: setSaveStatus('error'), button text remains "Confirm"
20. Retry path         → User can click Confirm again to retry the save
```

### 3c. Component Breakdown

#### **page.tsx** → Server Component

- **File**: `app/(buyer)/profile/page.tsx`
- **Type**: Server Component (Next.js 13+ default)
- **Props**: None (route component)
- **Responsibilities**: Authenticates user and fetches profile data from Supabase. Merges sources of truth (database profile + auth user metadata) into a single initial state object. Redirects unauthenticated users to login.
- **State**: None (server component)
- **Key Logic**:
  - Calls `supabase.auth.getUser()` to check authentication
  - Queries `users_profile` table for existing profile
  - Falls back to `user.user_metadata` for unset profile fields
  - Calculates `hasProfileRecord` and `emailConfirmed` booleans

#### **UserProfileForm** → Client Component

- **File**: `components/forms/user-profile-form.tsx`
- **Type**: Client Component (`'use client'`)
- **Props**:
  ```ts
  userId: string; // User's unique ID from Supabase Auth
  email: string; // User's email address
  emailConfirmed: boolean; // Whether email is verified
  hasProfileRecord: boolean; // Whether profile exists in users_profile table
  initialProfile: {
    fullName: string; // Initial full name (from DB or metadata)
    displayName: string; // Initial display name
    avatarUrl: string; // Initial avatar image URL
    phone: string; // Initial phone number
    role: string; // User role (e.g., 'buyer')
    profileCompleted: boolean; // Completion status
    updatedAt: string | null; // ISO timestamp of last update
  }
  ```
- **Responsibilities**: Manages all client-side form state, field editing, validation, dialog opening/closing, and API communication with Supabase. Displays loading states and error/success feedback. Respects reduced motion preference from OS.
- **State Variables**:
  ```ts
  const [fullName, setFullName]; // Text - user's full name
  const [displayName, setDisplayName]; // Text - display name
  const [phone, setPhone]; // Text - phone number
  const [avatarUrl, setAvatarUrl]; // Text - avatar URL
  const [role, setRole]; // Text - user role (read-only)
  const [profileCompleted, setProfileCompleted]; // Boolean - profile completion flag
  const [updatedAt, setUpdatedAt]; // Timestamp - last update time
  const [isEditing, setIsEditing]; // Boolean - form edit mode toggle
  const [isSaving, setIsSaving]; // Boolean - currently saving to DB
  const [dialogOpen, setDialogOpen]; // Boolean - confirmation dialog open
  const [saveStatus, setSaveStatus]; // 'idle' | 'success' | 'error'
  const [isResending, setIsResending]; // Boolean - resending verification email
  const [errorMessage, setErrorMessage]; // String | null - error text to display
  const [successMessage, setSuccessMessage]; // String | null - success text to display
  const [phoneFieldError, setPhoneFieldError]; // String | null - phone validation error
  const [focusedField, setFocusedField]; // EditableField | null - which field is focused
  const [validFlashField, setValidFlashField]; // EditableField | null - field with valid flash
  const [verificationMessage, setVerificationMessage]; // String - email verification feedback
  ```

---

## 4. Form Fields

| Field        | Type       | Validation                         | Required | Saved to                                                          | Notes                                                                   |
| ------------ | ---------- | ---------------------------------- | -------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Full name    | Text input | Trimmed, no max validation in form | Yes\*    | `users_profile.full_name`, `auth.users.user_metadata.full_name`   | Used for profile completion check; falls back to email if not set       |
| Display name | Text input | Trimmed, max 100 chars             | No       | `users_profile.display_name`, `auth.users.user_metadata.name`     | Optional; used in public display; falls back to full name               |
| Phone number | Text input | Regex: `^[+0-9()\-\s]{7,20}$`      | Yes\*    | `users_profile.phone`                                             | Required for marking profile as complete; shows inline validation error |
| Avatar URL   | Text input | URL format (not validated in form) | No       | `users_profile.avatar_url`, `auth.users.user_metadata.avatar_url` | Can be empty; displays fallback initials in avatar component if not set |

**Note**: Fields marked with `*` are required for `profile_completed` to be `true` (fullName + phone both non-empty).

### Field Behavior

- **On Edit**: Clicking pencil icon enables all editable fields and displays Cancel/Save buttons
- **On Blur**: Phone field is validated; if invalid, error persists until corrected or field loses focus
- **On Valid Entry**: Valid fields show a brief emerald border flash (500ms) for feedback
- **On Save Click**: Form is validated again before opening dialog; validation errors block save and show in dialog
- **On Cancel**: All fields reset to initial values; edit mode exits

---

## 5. Confirmation Dialog

### Trigger Behavior

Dialog opens when user:

1. Fills out at least one field change
2. Clicks "Save changes" button in non-editing view OR form submit

### Dialog Content

**Header**:

- **Title**: "Save changes?"
- **Description**: "You are about to update your profile. This will be saved to your account immediately."

**Body**:

- Summary section showing:
  - If changes exist: A list of changed fields (before → after)
  - If no changes: "No field changes detected."
- Success/error messages (conditionally shown based on `saveStatus`)

**Footer** (with `pt-6` padding):

- **Cancel Button**: Outline variant, always enabled, closes dialog without saving
- **Confirm Button**: Primary color (or destructive on error), disabled during save, shows state-dependent text

### Dialog States

| State   | Triggers                    | Button Text | Button Icon                    | Button Disabled | Dialog Closes |
| ------- | --------------------------- | ----------- | ------------------------------ | --------------- | ------------- |
| Idle    | Dialog opens                | "Confirm"   | None                           | No              | No            |
| Saving  | Confirm clicked             | "Saving..." | Spinner (rotating)             | Yes             | No            |
| Success | Save completes successfully | "Saved!"    | Check (spring scale animation) | Yes             | After 1500ms  |
| Error   | Save fails                  | "Confirm"   | None                           | No              | No            |

### Animation Details

- **Entry**: Spring animation (stiffness: 400, damping: 30) — scale 0.95→1, opacity 0→1, ~250ms
- **Exit**: Snappy exit — scale 1→0.97, opacity 1→0, ~150ms ease-in
- **Content Stagger**: Children enter with 50ms stagger, ~200ms per item
- **Reduced Motion**: All animations replaced with opacity-only fade (200ms enter, 100ms exit)

### Accessibility

- **Focus Management**: Focus auto-moves to Cancel button on dialog open (auto-focus prevented on Confirm)
- **Keyboard Navigation**: Tab cycles through Cancel → Confirm buttons; Escape closes dialog
- **ARIA Labels**: All interactive elements labeled; icon buttons suppressed from tab order with `aria-hidden`
- **Reduced Motion**: Honored via `useReducedMotion()` from Framer Motion

---

## 6. Loading & Feedback States

| State                           | Trigger                             | Where Shown                     | UI Displayed                                                                | Duration                                         |
| ------------------------------- | ----------------------------------- | ------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------ |
| **Field Validation**            | User blurs phone field              | Inline, below field             | Error text in red or validation passes (border flash in emerald)            | Until corrected                                  |
| **Saving**                      | Confirm button clicked              | Dialog button                   | "Saving..." + spinner icon (Loader2, rotating)                              | Until save completes or fails (~1-5s)            |
| **Success**                     | Save operation succeeds             | Dialog button + success message | "Saved!" + check icon; success message in emerald                           | Button shows for 1500ms, then dialog auto-closes |
| **Error**                       | Save operation fails                | Dialog button + error message   | Button reverts to "Confirm"; error text shown below buttons in red          | Persistent until user clicks Confirm to retry    |
| **Inline Success** (form-level) | Save succeeds without dialog        | Form area                       | "Profile updated successfully." in emerald                                  | 3000ms auto-dismiss                              |
| **Inline Error** (form-level)   | Validation fails before save        | Form area                       | Error message in red with subtle shake animation                            | 3000ms auto-dismiss unless in dialog (persists)  |
| **Email Verification Prompt**   | User email not confirmed            | Top of form area                | Banner: "Email is not verified..." + "Resend verification email" button     | Persistent until verified                        |
| **Reduced Motion**              | OS `prefers-reduced-motion` enabled | All animations                  | Spinners become fade-in-place; transitions use opacity only; no scale/slide | Same state timings                               |

---

## 7. Affected Files

| File                                     | Status   | Purpose                                                                                   |
| ---------------------------------------- | -------- | ----------------------------------------------------------------------------------------- |
| `app/(buyer)/profile/page.tsx`           | Created  | Server component that fetches user auth + profile data from Supabase and passes to form   |
| `components/forms/user-profile-form.tsx` | Created  | Client component managing profile form state, editing, validation, dialog, and save logic |
| `lib/animations.ts`                      | Modified | Added Framer Motion variants for form, dialog, spinner, and success state animations      |
| `lib/supabase/client.ts`                 | Existing | Used by form component for client-side Supabase operations                                |
| `lib/supabase/server.ts`                 | Existing | Used by page component for server-side auth + profile queries                             |

---

## 8. Supabase Integration

### Tables Used

**`users_profile`** (Read + Write)

- **Columns**: `user_id` (PK, FK to auth.users), `full_name`, `display_name`, `phone`, `avatar_url`, `role`, `profile_completed`, `updated_at`
- **Operations**:
  - **Read**: On page load, server-side query to fetch existing profile data
  - **Write**: Client-side CREATE (INSERT) if no record exists, or UPDATE if record exists

**`auth.users`** (Read + Metadata Write)

- **Columns Read**: `id`, `email`, `email_confirmed_at`, `user_metadata`
- **Metadata Write**: `full_name`, `name`, `avatar_url` (stored in `user_metadata` JSON)
- **Operations**:
  - **Read**: Auth session check + user object retrieval
  - **Metadata Update**: Background (non-blocking) update to sync profile changes

### Query Pattern

**Server-side (page.tsx)**:

```ts
// Fetch user from Supabase Auth
const {
  data: { user },
} = await supabase.auth.getUser();

// Fetch profile from users_profile table
const { data: profile } = await supabase
  .from('users_profile')
  .select('full_name, display_name, avatar_url, phone, role, profile_completed, updated_at')
  .eq('user_id', user.id)
  .maybeSingle();
```

**Client-side (form submit)**:

```ts
// Check if profile record exists; UPDATE or INSERT accordingly
if (hasProfileRecord) {
  await supabase.from('users_profile').update(profileData).eq('user_id', userId);
} else {
  await supabase.from('users_profile').insert({ user_id: userId, role, ...profileData });
}

// Update auth metadata (background, non-critical)
await supabase.auth.updateUser({
  data: { full_name, name: displayName ?? fullName, avatar_url },
});
```

### Update Pattern

- **Upsert Strategy**: Code explicitly checks `hasProfileRecord` boolean and chooses INSERT vs UPDATE
- **No `.upsert()`**: Custom handling allows validation before INSERT and provides better error context
- **Atomic Writes**: Each update is a single API call; `updated_at` is set to current ISO timestamp
- **Auth Metadata Sync**: Profile fields are synced to Supabase Auth `user_metadata` for cross-context availability

### Auth Requirement

**Page-level**:

- Server-side redirect: If no authenticated user, redirect to `/auth/login`

**Form-level**:

- Edit disabled: If `emailConfirmed === false`, show verification banner and disable edit button
- Save disabled: Phone validation error prevents save

### RLS Policies Required

```sql
-- users_profile table RLS
-- Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON users_profile FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON users_profile FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile"
  ON users_profile FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

---

## 9. Animation Summary

| Element                     | Animation                    | Type              | Duration                             | Library               | Config                                |
| --------------------------- | ---------------------------- | ----------------- | ------------------------------------ | --------------------- | ------------------------------------- |
| Form container (on mount)   | Fade up + scale 1            | Stagger + Fade    | 350ms fade, 60ms stagger             | Framer Motion         | `fadeUpVariants`                      |
| Form fields stagger         | Each field enters with delay | Stagger container | 6% delay between items               | Framer Motion         | `staggerContainerVariants`            |
| Dialog modal entry          | Scale 0.95→1 + fade + spring | Spring            | ~250ms spring (st: 400, da: 30)      | Framer Motion         | `dialogModalVariants`                 |
| Dialog modal exit           | Scale 1→0.97 + fade out      | Ease-in           | 150ms                                | Framer Motion         | `dialogModalVariants` exit            |
| Dialog content children     | Stagger in                   | Stagger           | 200ms per item, 5% stagger, 3% delay | Framer Motion         | `dialogContentStaggerVariants`        |
| Save button spinner         | 360° rotation infinite       | Linear            | 600ms per rotation                   | Framer Motion         | `spinnerTransition`                   |
| Success checkmark           | Scale 0.5→1 + fade           | Spring            | ~200ms spring (st: 320, da: 20)      | Framer Motion         | `successCheckVariants`                |
| Error message               | Slide up + fade + shake      | Combined          | 200ms fade + 400ms shake             | Framer Motion         | `inlineMessageVariants` + error shake |
| Label on focus              | Scale 0.98 + translate -1px  | CSS transform     | 150ms                                | Tailwind (transition) | Transform transition                  |
| Button on hover             | Scale 1.02                   | Scale animation   | 150ms                                | Framer Motion         | `whileHover={{ scale: 1.02 }}`        |
| Button on click             | Scale 0.97                   | Scale animation   | 100ms                                | Framer Motion         | `whileTap={{ scale: 0.97 }}`          |
| **Reduced Motion Variants** | Opacity only                 | Fade              | 200ms in, 100-120ms out              | Framer Motion         | `*ReducedVariants`                    |

**Reduced Motion**: All variants have a `*ReducedVariants` counterpart that replaces transform/scale with opacity-only fades. Active when `useReducedMotion()` returns true (OS `prefers-reduced-motion: reduce` setting).

---

## 10. How to Modify

### Adding a New Profile Field

**Step 1**: Add field to form JSX in `user-profile-form.tsx`

```tsx
<Input
  id="newField"
  value={newField}
  disabled={isSaving}
  onChange={(event) => setNewField(event.target.value)}
  onFocus={() => setFocusedField('newField')}
  onBlur={(event) => handleFieldBlur('newField', event.target.value)}
  placeholder="Description"
  maxLength={255}
  className={getInputMotionClassName('newField')}
/>
```

**Step 2**: Add state variable and initial value

```tsx
const [newField, setNewField] = useState(initialProfile.newField);

// In handleCancel, add:
setNewField(initialProfile.newField);

// In handleConfirmSave, add:
newField: toNull(newField),
```

**Step 3**: Add column to `users_profile` table in Supabase

```sql
ALTER TABLE users_profile ADD COLUMN new_field TEXT;
```

**Step 4**: Add to `changedFields` computation

```tsx
const changedFields = useMemo(() => {
  const fields = [
    // ... existing fields
    { label: 'New Field', before: initialProfile.newField, after: newField },
  ];
  return fields.filter((field) => field.before.trim() !== field.after.trim());
}, [newField, initialProfile.newField /* ... other deps */]);
```

**Step 5**: Update this documentation (Affected Files, Form Fields, and props type)

### Changing Confirmation Dialog Copy

**File**: `components/forms/user-profile-form.tsx`
**Location**: Search for `DialogTitle` and `DialogDescription` in the dialog JSX (around line 1015)
**Example**:

```tsx
<DialogTitle>Your Custom Title</DialogTitle>
<DialogDescription>Your custom description text.</DialogDescription>
```

No logic changes needed; CSS classes and state handling remain the same.

### Changing Save Timeout (when "Saved!" closes)

**File**: `components/forms/user-profile-form.tsx`
**Location**: `handleConfirmSave` function, the `setTimeout` after `setSaveStatus('success')`
**Current**: 1500ms
**Example to change to 2000ms**:

```ts
setTimeout(() => {
  setDialogOpen(false);
  setIsSaving(false);
  setSaveStatus('idle');
}, 2000); // ← change here
```

### Updating Animations

**File**: `lib/animations.ts`
**Pattern**: Add or modify variant definitions; do NOT inline animations in components

**Example — to slow down dialog entry**:

```ts
export const dialogModalVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: -8 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 400, damping: 30, duration: 0.4 }, // ← add duration
  },
  exit: {
    /* ... */
  },
};
```

### Disabling Email Verification Requirement

**File**: `components/forms/user-profile-form.tsx`
**Location**: Conditional rendering of the verification banner
**Current**:

```tsx
{!emailConfirmed ? (
  <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
    <p>Email is not verified...</p>
```

**To disable**: Delete or comment out the entire conditional block. Also remove the check disabling the edit button (if `!emailConfirmed`).

---

## 11. Testing Checklist

### Rendering & Display

- [ ] Profile page loads without auth redirects to `/auth/login`
- [ ] All form fields pre-populated with existing profile data
- [ ] Avatar displays as image if URL valid, falls back to initials
- [ ] User role badge and profile completion badge display correctly
- [ ] "Last Updated" timestamp displays localized date and time
- [ ] User ID and email display in info grid
- [ ] Mobile layout renders fields in 2-column grid on sm+ screens

### Edit Mode

- [ ] Clicking pencil icon enables edit mode and shows form fields
- [ ] Form fields are disabled while saving (isSaving=true)
- [ ] Labels scale and shift slightly on field focus
- [ ] Focused field has light background accent
- [ ] Cancel button appears alongside Save button in edit mode

### Validation

- [ ] Phone field validates on blur; invalid phone shows red error text
- [ ] Phone field regex accepts: `+`, `-`, `(`, `)`, spaces, 7-20 chars
- [ ] Phone field that previously had error updates validation on re-entry
- [ ] Valid field entry shows emerald border flash (500ms) on blur
- [ ] Validation error blocks save and persists in dialog

### Dialog & Save Flow

- [ ] Clicking "Save changes" opens confirmation dialog
- [ ] Dialog shows summary of all changed fields
- [ ] Dialog shows "No field changes detected" if no changes made
- [ ] Cancel button in dialog closes dialog and returns to edit mode (no data lost)
- [ ] Pressing Escape closes dialog
- [ ] Focus returns to Cancel button when dialog opens

### Saving States

- [ ] Clicking Confirm shows spinner + "Saving..." on button (1500ms visible)
- [ ] Confirm button is disabled during save (no double-click possible)
- [ ] "Saving..." state for ~1s (or actual network time)
- [ ] "Saved!" displays with check icon for ~1500ms
- [ ] Dialog closes automatically after 1500ms timeout
- [ ] Page refreshes via `router.refresh()` after save
- [ ] Form returns to read-only mode after save completes

### Error Handling

- [ ] Network error during save shows error message in dialog
- [ ] Confirm button resets to "Confirm" on error (not disabled)
- [ ] Error message text displayed in red below buttons
- [ ] User can click Confirm again to retry save
- [ ] Cancel button works even with error state

### Email Verification

- [ ] If email not verified, banner appears: "Email is not verified..."
- [ ] Edit button is disabled when email not verified
- [ ] "Resend verification email" button is clickable
- [ ] Clicking resend shows "Sending..." temporarily
- [ ] Resend completes with success message

### Reduced Motion

- [ ] With `prefers-reduced-motion: reduce`, all animations use opacity-only
- [ ] No scale, translate, or rotate animations play
- [ ] Form still enters and content still appears just without motion
- [ ] Dialog still fades in/out without spring entrance

### Accessibility

- [ ] All interactive elements keyboard-navigable (Tab order correct)
- [ ] Dialog opens with focus on Cancel button
- [ ] Spinner icon has `aria-hidden="true"`
- [ ] Form labels associated with inputs via `htmlFor`
- [ ] Error messages and status text announced to screen readers
- [ ] Keyboard-only users can open/close dialog and submit form

### Mobile & Responsive

- [ ] Form fields stack vertically on mobile (1 column)
- [ ] Form fields display in 2-column grid on sm+ screens
- [ ] Avatar displays at correct size on mobile (h-16 w-16)
- [ ] Dialog fits within mobile viewport
- [ ] Button text and icons scale appropriately

### Data Integrity

- [ ] Empty fields saved as `null` in database (via `toNull()` helper)
- [ ] Whitespace-only entries treated as empty
- [ ] `profile_completed` only true when fullName + phone both non-empty
- [ ] `updated_at` timestamp set to current ISO on every save
- [ ] Auth metadata synced: `full_name`, `name`, `avatar_url`

### Cross-Browser

- [ ] Chrome/Edge: All animations smooth, no jank
- [ ] Firefox: All animations smooth, spinners rotate correctly
- [ ] Safari: Spring animations perform well, no animation frame drops
- [ ] Mobile Safari: Reduced motion respected from system settings

---

## 12. Known Limitations & Next Steps

### Known Limitations

1. **Avatar URL Validation**: Avatar URL is not validated before saving. Invalid URLs fail silently; no preview provided before save.
   - **Workaround**: Add image URL validator + preview before save in future sprint
2. **Phone Field Regex**: Phone validation regex is simple and may reject valid international formats outside the pattern.
   - **Workaround**: Use a phone parsing library (e.g., `libphonenumber-js`) for better validation

3. **Concurrent Edits**: If user edits profile in two tabs simultaneously, last write wins (no conflict detection).
   - **Workaround**: Add optimistic locking or version field to `users_profile` table in future

4. **Auth Metadata Sync Non-Blocking**: Auth metadata update fails silently; user may not notice if sync fails.
   - **Workaround**: Add retry mechanism or alert user if metadata update fails

5. **Single Save Entry Point**: Form allows save only via dialog confirmation; no quick-save or keyboard shortcut.
   - **Future**: Add Cmd/Ctrl+S save shortcut

### Suggested Follow-up Tasks

- [ ] **USER-02**: Add profile image upload (replace URL input with file uploader)
- [ ] **AUTH-XX**: Strengthen email verification flow (send new verification email if expired)
- [ ] **UI-XX**: Add a "Last saved by" indicator showing which device/browser made last change
- [ ] **PERF-XX**: Implement client-side caching to prevent re-fetching profile on every visit
- [ ] **A11Y-XX**: Add ARIA live region for save status to announce to screen readers
- [ ] **TEST-XX**: Add E2E tests (Playwright/Cypress) for complete save flow

### Technical Debt

- `handleSave` and `handleConfirmSave` duplicate validation logic; refactor to shared function
- Consider moving validation utilities to `lib/validators.ts`
- Animation variants in `lib/animations.ts` could be grouped by feature (dialog, form, etc.)

---

## Document Metadata

| Attribute        | Value                                       |
| ---------------- | ------------------------------------------- |
| **Last Updated** | March 18, 2026                              |
| **Sprint**       | User Profile (Sprint USER-01)               |
| **Owner**        | Frontend Team                               |
| **Status**       | Completed                                   |
| **Component**    | User Profile Form (`user-profile-form.tsx`) |

# USER-04: User Settings Page

## Overview

The User Settings Page is a comprehensive account management interface located at `/profile/settings`. It provides users with a centralized hub to manage their preferences, privacy settings, and security configurations.

## Features

### 1. **Preferences Tab**
- **Theme Preference**: Switch between System, Light, and Dark modes
- **Timezone Selection**: Choose from 6 timezone options (UTC, Asia/Dhaka, Asia/Kolkata, Asia/Singapore, Europe/London, America/New_York)
- **Red Toggle Switches** for:
  - Email notifications (account activity & alerts)
  - Product alerts (updates & recommendation changes)
  - Marketing emails (special offers & campaigns)

### 2. **Privacy Tab**
- **Red Toggle Switch** for public profile visibility
- Control whether your profile appears in shared buyer experiences

### 3. **Security Tab**
- **Password Update Form** with:
  - New password field (minimum 8 characters)
  - Confirm password field
  - Real-time validation
  - **Confirmation Dialog** before password change (prevents accidental updates)

### 4. **Account Header**
Displays:
- Account email address
- User role (Buyer/Seller)
- Email verification status
- Last updated timestamp
- User ID

## UI Components

### Toggle Switch (`ToggleSwitch`)
A custom red-themed toggle component with:
- Smooth transition animations (Framer Motion)
- Accessibility support (keyboard focusable, ARIA compliant)
- Red color scheme when enabled (`bg-red-500` / `bg-red-600` dark)
- Disabled state with opacity reduction
- Responsive label integration

**Usage:**
```tsx
<ToggleSwitch
  id="emailNotifications"
  checked={preferences.emailNotifications}
  onCheckedChange={(checked) => handleChange(checked)}
  disabled={isSaving}
/>
```

### Confirmation Dialog
Modal dialog that appears before password update with:
- Clear warning message
- Cancel and Confirm buttons
- Prevents accidental password changes
- Integrated with Framer Motion for smooth entry

**Triggers:**
- Form submission in Security tab when all validations pass

## Animations (Framer Motion)

### Card Motion
```
Initial State: opacity 0, translate Y 14px
Final State: opacity 1, translate Y 0
Duration: 450ms
Easing: cubic-bezier(0.22, 1, 0.36, 1) - smooth deceleration
```

### Tab Panel Motion
```
Initial State: opacity 0, translate Y 10px
Final State: opacity 1, translate Y 0
Duration: 250ms
Easing: cubic-bezier(0.2, 0.9, 0.3, 1) - snappy ease-out
```

These animations provide visual feedback that the UI is interactive and enhance perceived responsiveness.

## Mobile Responsiveness

### Breakpoints
- **Mobile (< 640px)**: Single column, full-width buttons (h-11 height for 44px touch targets)
- **Tablet+ (≥ 640px)**: Two-column grids where applicable, h-10 button height

### Responsive Elements
1. **Header**
   - Title: `text-lg sm:text-xl`
   - Description: `text-xs sm:text-sm`
   - Badges: Flex-wrap with gap-2

2. **Info Grid** (Account details)
   - Mobile: Single column
   - Tablet+: 3-column grid
   - Consistent padding and typography scaling

3. **Preference/Privacy Cards**
   - Mobile: Text + toggle on same row with flex wrap
   - Display: `flex items-start justify-between`
   - Toggle positioned to the right

4. **Form Fields** (Theme, Timezone, Password)
   - Preferences: 2-column grid
   - Mobile: Single column (sm:grid-cols-2)
   - Input heights: h-11 (mobile), sm:h-10 (tablet+)

## Technical Implementation

### Component File
**Path:** `main-app/components/forms/user-settings-form.tsx`

### Props Interface
```tsx
type UserSettingsFormProps = {
  userId: string;
  email: string;
  role: string;
  emailVerified: boolean;
  hasProfileRecord: boolean;
  initialUpdatedAt: string | null;
  initialPreferences: UserSettingsPreferences;
};

type UserSettingsPreferences = {
  emailNotifications: boolean;
  productAlerts: boolean;
  marketingEmails: boolean;
  publicProfile: boolean;
  theme: 'system' | 'light' | 'dark';
  timezone: string;
};
```

### State Management
- **Preferences State**: Tracks user preference selections
- **Password State**: Separate states for password, confirmPassword, isUpdatingPassword
- **UI State**: Loading flags (isSavingPreferences, isUpdatingPassword), error/success messages
- **Dialog State**: isConfirmDialogOpen for password confirmation

### Key Functions
1. **`handleSavePreferences`**: Saves preference/privacy settings via server action
2. **`handlePasswordSubmit`**: Form submission handler that opens confirmation dialog
3. **`handleUpdatePassword`**: Performs actual password update via Supabase
4. **`handleConfirmPasswordUpdate`**: Closes dialog and triggers password update
5. **`getErrorMessage`**: Normalizes error objects for display

### Dependencies
- `next/navigation`: Router for page refresh
- `next-themes`: Theme management integration
- `@radix-ui`: Dialog and form UI primitives
- `framer-motion`: Animation library
- `lucide-react`: Icon library
- Supabase: Authentication & password update

### Auto-Dismiss Messages
Success/error messages auto-dismiss after 3 seconds via `setTimeout`. Timer is cleared when:
- User switches tabs
- Component unmounts
- New message appears

## Validation & Error Handling

### Password Validation
1. Minimum 8 characters required
2. Password and confirm password must match
3. Real-time validation feedback with inline messages
4. Button disabled until all validations pass

### Error Messages
- Normalized from various error object types
- Falls back to generic message if error structure unknown
- Displayed for 3 seconds then auto-dismissed

## Recent Updates

### v1.1 - Confirmation Dialog & Toggle Switches
- Added confirmation dialog before password change
- Replaced checkboxes with red toggle switches
- Improved mobile layout for toggle cards
- Enhanced accessibility with label wrapping

### v1.0 - Framer Motion Integration
- Added entrance animations to settings card
- Tab panel animations on switch
- Smooth visual feedback on interaction

## Future Enhancements

1. **Two-Factor Authentication (2FA)**: Add TOTP setup in Security tab
2. **Session Management**: View active sessions and sign out remotely
3. **Activity Log**: Display recent account activity
4. **Download Data**: GDPR compliance - export user data
5. **Account Deletion**: Safe account removal with confirmation
6. **Notification Preferences**: Granular control by notification type
7. **Linked Accounts**: Connect social logins or third-party services

## Testing Checklist

- Preferences save without errors
- Privacy settings persist across page refresh
- Password update requires confirmation dialog
- Toggles work on mobile (44px touch targets)
- Tab switching clears messages
- Messages auto-dismiss after 3 seconds
- Animations play smoothly on all tabs
- Validation prevents invalid password submission
- Error messages displayed and cleared correctly
- Theme change applies immediately
- Timezone persists on refresh

## Styling Notes

- **Colors**: Rose/pink/amber gradients with red accents for key actions
- **Dark Mode**: Supported with corresponding color palettes (dark: prefixes)
- **Spacing**: Consistent use of space-y-4, space-y-6 for vertical rhythm
- **Border Radius**: sm:rounded-lg for cards, rounded-full for badges
- **Shadows**: shadow-md for cards, shadow-sm for info boxes
- **Transitions**: All interactive elements have smooth hover states and transitions

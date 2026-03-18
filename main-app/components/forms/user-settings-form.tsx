'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { createClient } from '@/lib/supabase/client';
import { savePreferences } from '@/lib/actions/settings';

type ThemePreference = 'system' | 'light' | 'dark';

type UserSettingsPreferences = {
  emailNotifications: boolean;
  productAlerts: boolean;
  marketingEmails: boolean;
  publicProfile: boolean;
  theme: ThemePreference;
  timezone: string;
};

type UserSettingsFormProps = {
  userId: string;
  email: string;
  role: string;
  emailVerified: boolean;
  hasProfileRecord: boolean;
  initialUpdatedAt: string | null;
  initialPreferences: UserSettingsPreferences;
};

const timezoneOptions = [
  { value: 'UTC', label: 'UTC' },
  { value: 'Asia/Dhaka', label: 'Asia/Dhaka' },
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore' },
  { value: 'Europe/London', label: 'Europe/London' },
  { value: 'America/New_York', label: 'America/New_York' },
];

function formatRole(role: string): string {
  if (!role) {
    return 'Buyer';
  }

  return role.charAt(0).toUpperCase() + role.slice(1);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim().length > 0) {
      return message;
    }
  }

  return 'Something went wrong. Please try again.';
}

export function UserSettingsForm({
  userId,
  email,
  role,
  emailVerified,
  hasProfileRecord,
  initialUpdatedAt,
  initialPreferences,
}: UserSettingsFormProps) {
  const router = useRouter();
  const { setTheme } = useTheme();
  const dismissTimerRef = useRef<number | null>(null);
  const [currentTab, setCurrentTab] = useState('preferences');
  const [preferences, setPreferences] = useState<UserSettingsPreferences>(initialPreferences);
  const [updatedAt, setUpdatedAt] = useState<string | null>(initialUpdatedAt);
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  const [preferencesError, setPreferencesError] = useState<string | null>(null);
  const [preferencesSuccess, setPreferencesSuccess] = useState<string | null>(null);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const passwordNeedsMoreChars = password.length > 0 && password.length < 8;
  const passwordMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const lastUpdated = useMemo(() => {
    if (!updatedAt) {
      return 'Never updated';
    }

    const date = new Date(updatedAt);
    if (Number.isNaN(date.getTime())) {
      return 'Unknown';
    }

    return date.toLocaleString();
  }, [updatedAt]);

  // Auto-dismiss messages after 3 seconds
  useEffect(() => {
    const hasMessage = preferencesError || preferencesSuccess || passwordError || passwordSuccess;
    if (!hasMessage) {
      return;
    }

    if (dismissTimerRef.current) {
      window.clearTimeout(dismissTimerRef.current);
    }

    dismissTimerRef.current = window.setTimeout(() => {
      setPreferencesError(null);
      setPreferencesSuccess(null);
      setPasswordError(null);
      setPasswordSuccess(null);
    }, 3000);

    return () => {
      if (dismissTimerRef.current) {
        window.clearTimeout(dismissTimerRef.current);
      }
    };
  }, [preferencesError, preferencesSuccess, passwordError, passwordSuccess]);

  // Clear messages when switching tabs
  useEffect(() => {
    setPreferencesError(null);
    setPreferencesSuccess(null);
    setPasswordError(null);
    setPasswordSuccess(null);
  }, [currentTab]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) {
        window.clearTimeout(dismissTimerRef.current);
      }
    };
  }, []);

  const handleSavePreferences = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSavingPreferences(true);
    setPreferencesError(null);
    setPreferencesSuccess(null);

    if (!hasProfileRecord) {
      setPreferencesError(
        'Profile record is not initialized yet. Please sign out and sign in again.',
      );
      setIsSavingPreferences(false);
      return;
    }

    try {
      const result = await savePreferences(userId, preferences);

      if (!result.success) {
        throw new Error(result.error || 'Failed to save preferences');
      }

      setUpdatedAt(result.updatedAt);
      setTheme(preferences.theme);
      setPreferencesSuccess('Preferences saved successfully.');
      router.refresh();
    } catch (error: unknown) {
      setPreferencesError(getErrorMessage(error));
    } finally {
      setIsSavingPreferences(false);
    }
  };

  const handleUpdatePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsUpdatingPassword(true);
    setPasswordError(null);
    setPasswordSuccess(null);

    if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters long.');
      setIsUpdatingPassword(false);
      return;
    }

    if (password !== confirmPassword) {
      setPasswordError('Password and confirmation do not match.');
      setIsUpdatingPassword(false);
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        throw error;
      }

      setPassword('');
      setConfirmPassword('');
      setPasswordSuccess('Password updated successfully.');
    } catch (error: unknown) {
      setPasswordError(getErrorMessage(error));
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-pink-200/80 bg-linear-to-br from-rose-50 via-background to-amber-50/70 shadow-md dark:border-pink-500/30 dark:from-rose-950/25 dark:via-background dark:to-amber-950/20">
        <CardHeader className="space-y-4 bg-[radial-gradient(circle_at_top_right,rgba(244,114,182,0.14),transparent_45%),radial-gradient(circle_at_bottom_left,rgba(251,191,36,0.14),transparent_40%)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {/* RESPONSIVE: Title and description scale down on mobile for readability */}
              <CardTitle className="text-lg sm:text-xl text-rose-700 dark:text-rose-200">
                Account Settings
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Update your preferences and secure your account.
              </CardDescription>
            </div>
            {/* RESPONSIVE: Badges flex-wrap with gap-2 to avoid cramping on mobile */}
            <div className="flex flex-wrap gap-2">
              <Badge
                variant="secondary"
                className="rounded-full border-pink-200 bg-pink-100/80 text-rose-700 dark:border-pink-500/40 dark:bg-rose-900/30 dark:text-rose-200"
              >
                {formatRole(role)}
              </Badge>
              <Badge variant={emailVerified ? 'default' : 'outline'} className="rounded-full">
                {emailVerified ? 'Email verified' : 'Email not verified'}
              </Badge>
            </div>
          </div>

          {/* RESPONSIVE: Info grid - single column on mobile, 3 columns on tablet+ for better spacing */}
          <div className="grid gap-2 text-xs sm:text-sm text-muted-foreground sm:grid-cols-3">
            <div className="rounded-xl border border-pink-100 bg-white/70 px-3 py-2 shadow-sm dark:border-pink-500/20 dark:bg-rose-950/10">
              <p className="text-xs uppercase tracking-wide">Account Email</p>
              <p className="mt-1 text-xs sm:text-sm font-medium text-foreground truncate">
                {email}
              </p>
            </div>
            <div className="rounded-xl border border-pink-100 bg-white/70 px-3 py-2 shadow-sm dark:border-pink-500/20 dark:bg-rose-950/10">
              <p className="text-xs uppercase tracking-wide">Last Updated</p>
              <p className="mt-1 text-xs sm:text-sm font-medium text-foreground">{lastUpdated}</p>
            </div>
            <div className="rounded-xl border border-pink-100 bg-white/70 px-3 py-2 shadow-sm dark:border-pink-500/20 dark:bg-rose-950/10">
              <p className="text-xs uppercase tracking-wide">User ID</p>
              <p className="mt-1 truncate text-xs sm:text-sm font-medium text-foreground">
                {userId}
              </p>
            </div>
          </div>
        </CardHeader>

        <Separator />

        <CardContent className="pt-6 px-4 sm:px-6">
          {!hasProfileRecord ? (
            <div className="mb-4 rounded-lg border bg-muted/40 px-4 py-3 text-xs sm:text-sm text-muted-foreground">
              Profile record is not initialized yet. Please sign out and sign in again.
            </div>
          ) : null}

          <Tabs value={currentTab} onValueChange={setCurrentTab} className="space-y-6">
            <TabsList>
              <TabsTrigger value="preferences">Preferences</TabsTrigger>
              <TabsTrigger value="privacy">Privacy</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
            </TabsList>

            <TabsContent value="preferences" className="space-y-4">
              <form className="space-y-6" onSubmit={handleSavePreferences}>
                {/* RESPONSIVE: Select fields grid - single column on mobile, 2 columns on tablet+ */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="themePreference" className="text-xs sm:text-sm font-medium">
                      Theme preference
                    </Label>
                    <Select
                      value={preferences.theme}
                      onValueChange={(value) =>
                        setPreferences((prev) => ({
                          ...prev,
                          theme: value as ThemePreference,
                        }))
                      }
                      disabled={isSavingPreferences || !hasProfileRecord}
                    >
                      <SelectTrigger id="themePreference" className="h-11 sm:h-10">
                        <SelectValue placeholder="Choose a theme" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="system">System</SelectItem>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="timezonePreference" className="text-xs sm:text-sm font-medium">
                      Timezone
                    </Label>
                    <Select
                      value={preferences.timezone}
                      onValueChange={(value) =>
                        setPreferences((prev) => ({
                          ...prev,
                          timezone: value,
                        }))
                      }
                      disabled={isSavingPreferences || !hasProfileRecord}
                    >
                      <SelectTrigger id="timezonePreference" className="h-11 sm:h-10">
                        <SelectValue placeholder="Choose a timezone" />
                      </SelectTrigger>
                      <SelectContent>
                        {timezoneOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* RESPONSIVE: Checkbox cards grid - single column on mobile, 2 columns on tablet+, full width touch targets */}
                <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
                  <div className="flex gap-3 rounded-lg border p-3 sm:p-4 hover:bg-accent/50 transition-colors">
                    <Checkbox
                      id="emailNotifications"
                      checked={preferences.emailNotifications}
                      onCheckedChange={(checked) =>
                        setPreferences((prev) => ({
                          ...prev,
                          emailNotifications: checked === true,
                        }))
                      }
                      disabled={isSavingPreferences || !hasProfileRecord}
                      className="mt-0.5 sm:mt-1"
                    />
                    <span className="space-y-1">
                      <Label
                        htmlFor="emailNotifications"
                        className="block text-xs sm:text-sm font-medium cursor-pointer"
                      >
                        Email notifications
                      </Label>
                      <span className="block text-xs text-muted-foreground">
                        Receive updates on account activity and important alerts.
                      </span>
                    </span>
                  </div>

                  <div className="flex gap-3 rounded-lg border p-3 sm:p-4 hover:bg-accent/50 transition-colors">
                    <Checkbox
                      id="productAlerts"
                      checked={preferences.productAlerts}
                      onCheckedChange={(checked) =>
                        setPreferences((prev) => ({
                          ...prev,
                          productAlerts: checked === true,
                        }))
                      }
                      disabled={isSavingPreferences || !hasProfileRecord}
                      className="mt-0.5 sm:mt-1"
                    />
                    <span className="space-y-1">
                      <Label
                        htmlFor="productAlerts"
                        className="block text-xs sm:text-sm font-medium cursor-pointer"
                      >
                        Product alerts
                      </Label>
                      <span className="block text-xs text-muted-foreground">
                        Get notified about product updates and recommendation changes.
                      </span>
                    </span>
                  </div>

                  <div className="flex gap-3 rounded-lg border p-3 sm:p-4 hover:bg-accent/50 transition-colors sm:col-span-2">
                    <Checkbox
                      id="marketingEmails"
                      checked={preferences.marketingEmails}
                      onCheckedChange={(checked) =>
                        setPreferences((prev) => ({
                          ...prev,
                          marketingEmails: checked === true,
                        }))
                      }
                      disabled={isSavingPreferences || !hasProfileRecord}
                      className="mt-0.5 sm:mt-1"
                    />
                    <span className="space-y-1">
                      <Label
                        htmlFor="marketingEmails"
                        className="block text-xs sm:text-sm font-medium cursor-pointer"
                      >
                        Marketing emails
                      </Label>
                      <span className="block text-xs text-muted-foreground">
                        Receive special offers, campaigns, and newsletter content.
                      </span>
                    </span>
                  </div>
                </div>

                {preferencesError ? (
                  <p className="text-xs sm:text-sm text-red-600">{preferencesError}</p>
                ) : null}
                {preferencesSuccess ? (
                  <p className="text-xs sm:text-sm text-emerald-600">{preferencesSuccess}</p>
                ) : null}

                {/* RESPONSIVE: Full width button on mobile, auto on tablet+ */}
                <Button
                  type="submit"
                  disabled={isSavingPreferences || !hasProfileRecord}
                  className="w-full sm:w-auto h-11 sm:h-10"
                >
                  {isSavingPreferences ? 'Saving...' : 'Save preferences'}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="privacy" className="space-y-4">
              <form className="space-y-4" onSubmit={handleSavePreferences}>
                <div className="flex gap-3 rounded-lg border p-3 sm:p-4 hover:bg-accent/50 transition-colors">
                  <Checkbox
                    id="publicProfile"
                    checked={preferences.publicProfile}
                    onCheckedChange={(checked) =>
                      setPreferences((prev) => ({
                        ...prev,
                        publicProfile: checked === true,
                      }))
                    }
                    disabled={isSavingPreferences || !hasProfileRecord}
                    className="mt-0.5 sm:mt-1"
                  />
                  <span className="space-y-1">
                    <Label
                      htmlFor="publicProfile"
                      className="block text-xs sm:text-sm font-medium cursor-pointer"
                    >
                      Public profile visibility
                    </Label>
                    <span className="block text-xs text-muted-foreground">
                      Allow your profile to be visible in shared buyer experiences.
                    </span>
                  </span>
                </div>

                {preferencesError ? (
                  <p className="text-xs sm:text-sm text-red-600">{preferencesError}</p>
                ) : null}
                {preferencesSuccess ? (
                  <p className="text-xs sm:text-sm text-emerald-600">{preferencesSuccess}</p>
                ) : null}

                <Button
                  type="submit"
                  disabled={isSavingPreferences || !hasProfileRecord}
                  className="w-full sm:w-auto h-11 sm:h-10"
                >
                  {isSavingPreferences ? 'Saving...' : 'Save privacy settings'}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="security" className="space-y-4">
              <form className="space-y-4" onSubmit={handleUpdatePassword}>
                {/* RESPONSIVE: Password fields grid - single column on mobile, 2 columns on tablet+, 44px touch target height */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="newPassword" className="text-xs sm:text-sm font-medium">
                      New password
                    </Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="At least 8 characters"
                      minLength={8}
                      disabled={isUpdatingPassword}
                      className="h-11 sm:h-10"
                    />
                    {passwordNeedsMoreChars ? (
                      <p className="text-xs text-amber-600" aria-live="polite">
                        Password must be at least 8 characters ({password.length}/8).
                      </p>
                    ) : null}
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="confirmPassword" className="text-xs sm:text-sm font-medium">
                      Confirm password
                    </Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder="Re-enter new password"
                      minLength={8}
                      disabled={isUpdatingPassword}
                      className="h-11 sm:h-10"
                    />
                    {passwordMismatch ? (
                      <p className="text-xs text-amber-600" aria-live="polite">
                        Password and confirmation do not match yet.
                      </p>
                    ) : null}
                  </div>
                </div>

                {passwordError ? (
                  <p className="text-xs sm:text-sm text-red-600">{passwordError}</p>
                ) : null}
                {passwordSuccess ? (
                  <p className="text-xs sm:text-sm text-emerald-600">{passwordSuccess}</p>
                ) : null}

                <Button
                  type="submit"
                  disabled={
                    isUpdatingPassword ||
                    password.length < 8 ||
                    confirmPassword.length === 0 ||
                    passwordMismatch
                  }
                  className="w-full sm:w-auto h-11 sm:h-10"
                >
                  {isUpdatingPassword ? 'Updating...' : 'Update password'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

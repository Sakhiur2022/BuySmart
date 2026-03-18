'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { AlertCircle, Check, CheckCircle2, Loader2, Pencil } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  dialogContentItemVariants,
  dialogContentStaggerVariants,
  dialogModalReducedVariants,
  dialogModalVariants,
  fadeUpReducedVariants,
  fadeUpVariants,
  inlineMessageReducedVariants,
  inlineMessageVariants,
  springScaleReducedVariants,
  springScaleVariants,
  spinnerTransition,
  staggerContainerReducedVariants,
  staggerContainerVariants,
  successCheckVariants,
  validationMessageVariants,
} from '@/lib/animations';
import { createClient } from '@/lib/supabase/client';

type UserProfileFormProps = {
  userId: string;
  email: string;
  emailConfirmed: boolean;
  hasProfileRecord: boolean;
  initialProfile: {
    fullName: string;
    displayName: string;
    avatarUrl: string;
    phone: string;
    role: string;
    profileCompleted: boolean;
    updatedAt: string | null;
  };
};

type EditableField = 'fullName' | 'displayName' | 'phone' | 'avatarUrl';

function toNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getInitials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean).slice(0, 2);

  if (parts.length === 0) {
    return 'BS';
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('');
}

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

  return 'Failed to update profile.';
}

export function UserProfileForm({
  userId,
  email,
  emailConfirmed,
  hasProfileRecord,
  initialProfile,
}: UserProfileFormProps) {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();
  const formRef = useRef<HTMLFormElement>(null);
  const saveButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const dismissTimerRef = useRef<number | null>(null);
  const fieldFlashTimerRef = useRef<number | null>(null);
  const [fullName, setFullName] = useState(initialProfile.fullName);
  const [displayName, setDisplayName] = useState(initialProfile.displayName);
  const [phone, setPhone] = useState(initialProfile.phone);
  const [avatarUrl, setAvatarUrl] = useState(initialProfile.avatarUrl);
  const [role] = useState(initialProfile.role);
  const [profileCompleted, setProfileCompleted] = useState(initialProfile.profileCompleted);
  const [updatedAt, setUpdatedAt] = useState<string | null>(initialProfile.updatedAt);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isResending, setIsResending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [phoneFieldError, setPhoneFieldError] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<EditableField | null>(null);
  const [validFlashField, setValidFlashField] = useState<EditableField | null>(null);
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null);

  const identityName = displayName.trim() || fullName.trim() || email;
  const initials = getInitials(identityName);

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

  const canEdit = true;
  const fadeVariants = shouldReduceMotion ? fadeUpReducedVariants : fadeUpVariants;
  const staggerVariants = shouldReduceMotion
    ? staggerContainerReducedVariants
    : staggerContainerVariants;
  const dialogPanelVariants = shouldReduceMotion ? springScaleReducedVariants : springScaleVariants;
  const messageVariants = shouldReduceMotion ? inlineMessageReducedVariants : inlineMessageVariants;
  // ANIMATION: Dialog entry/exit variants respect prefers-reduced-motion
  const dialogModalVar = shouldReduceMotion ? dialogModalReducedVariants : dialogModalVariants;

  const getInputMotionClassName = (field: EditableField) => {
    const base =
      'transition-colors duration-150 focus:border-primary focus:bg-accent/30 data-[state=error]:border-red-500';

    if (field === 'phone' && phoneFieldError) {
      return `${base} border-red-500`;
    }

    if (validFlashField === field) {
      return `${base} border-emerald-500`;
    }

    return base;
  };

  const validatePhoneField = (value: string): string | null => {
    const normalizedPhone = value.trim();
    if (!normalizedPhone) {
      return null;
    }

    if (!/^[+0-9()\-\s]{7,20}$/.test(normalizedPhone)) {
      return 'Phone number can contain only digits, spaces, parentheses, + or -.';
    }

    return null;
  };

  const triggerValidFlash = (field: EditableField) => {
    if (fieldFlashTimerRef.current) {
      window.clearTimeout(fieldFlashTimerRef.current);
    }

    setValidFlashField(field);
    fieldFlashTimerRef.current = window.setTimeout(() => {
      setValidFlashField(null);
    }, 500);
  };

  const handleFieldBlur = (field: EditableField, value: string) => {
    setFocusedField((current) => (current === field ? null : current));

    if (field === 'phone') {
      const error = validatePhoneField(value);
      setPhoneFieldError(error);
      if (!error && value.trim()) {
        triggerValidFlash(field);
      }
      return;
    }

    if (value.trim()) {
      triggerValidFlash(field);
    }
  };

  useEffect(() => {
    const activeMessage = errorMessage || successMessage;
    const persistDialogError = dialogOpen && saveStatus === 'error';

    if (!activeMessage || persistDialogError) {
      return;
    }

    if (dismissTimerRef.current) {
      window.clearTimeout(dismissTimerRef.current);
    }

    // ANIMATION: Auto-dismiss inline status feedback after a short visible duration.
    dismissTimerRef.current = window.setTimeout(() => {
      setErrorMessage(null);
      setSuccessMessage(null);
    }, 3000);

    return () => {
      if (dismissTimerRef.current) {
        window.clearTimeout(dismissTimerRef.current);
      }
    };
  }, [dialogOpen, errorMessage, saveStatus, successMessage]);

  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) {
        window.clearTimeout(dismissTimerRef.current);
      }
      if (fieldFlashTimerRef.current) {
        window.clearTimeout(fieldFlashTimerRef.current);
      }
    };
  }, []);

  const changedFields = useMemo(() => {
    const fields = [
      {
        label: 'Full name',
        before: initialProfile.fullName,
        after: fullName,
      },
      {
        label: 'Display name',
        before: initialProfile.displayName,
        after: displayName,
      },
      {
        label: 'Phone number',
        before: initialProfile.phone,
        after: phone,
      },
      {
        label: 'Avatar URL',
        before: initialProfile.avatarUrl,
        after: avatarUrl,
      },
    ];

    return fields.filter((field) => field.before.trim() !== field.after.trim());
  }, [
    avatarUrl,
    displayName,
    fullName,
    initialProfile.avatarUrl,
    initialProfile.displayName,
    initialProfile.fullName,
    initialProfile.phone,
    phone,
  ]);

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);

    if (!open) {
      setSaveStatus('idle');
      saveButtonRef.current?.focus();
    }
  };

  const handleSubmitRequest = (event: React.FormEvent<HTMLFormElement>) => {
    if (!dialogOpen) {
      event.preventDefault();
      setSaveStatus('idle');
      setDialogOpen(true);
      return;
    }

    void handleSave(event);
  };

  // CHANGE: New async handler wrapping save logic with loading states
  const handleConfirmSave = async () => {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    setSaveStatus('idle');
    setErrorMessage(null);
    setSuccessMessage(null);

    const normalizedPhone = phone.trim();
    const nextPhoneError = validatePhoneField(phone);
    setPhoneFieldError(nextPhoneError);
    if (nextPhoneError) {
      setErrorMessage(nextPhoneError);
      setSaveStatus('error');
      setIsSaving(false);
      return;
    }

    const nextProfileCompleted = Boolean(fullName.trim() && normalizedPhone);

    try {
      const supabase = createClient();
      const now = new Date().toISOString();

      const profileData = {
        full_name: toNull(fullName),
        display_name: toNull(displayName),
        phone: toNull(phone),
        avatar_url: toNull(avatarUrl),
        profile_completed: nextProfileCompleted,
        updated_at: now,
      };

      console.log('📝 Save attempt:', {
        userId,
        hasProfileRecord,
        profileData,
        formValues: { fullName, displayName, phone, avatarUrl },
      });

      let profileError = null;
      let saveResult = null;

      // Try to update existing record
      if (hasProfileRecord) {
        const result = await supabase
          .from('users_profile')
          .update(profileData)
          .eq('user_id', userId);

        profileError = result.error;
        saveResult = result;
        console.log('UPDATE result:', {
          data: result.data,
          error: result.error,
          status: result.status,
        });
      } else {
        // No existing record, try to insert
        const result = await supabase.from('users_profile').insert({
          user_id: userId,
          role: role,
          ...profileData,
        });

        profileError = result.error;
        saveResult = result;
        console.log('INSERT result:', {
          data: result.data,
          error: result.error,
          status: result.status,
        });
      }

      if (profileError) {
        console.error('Profile save error:', profileError);
        throw profileError;
      }

      // Check for silent failures
      if (!saveResult) {
        throw new Error('Unexpected: No result returned from database operation');
      }

      // Profile saved successfully
      setProfileCompleted(nextProfileCompleted);
      setUpdatedAt(now);
      setIsEditing(false);
      setSuccessMessage('Profile updated successfully.');
      setSaveStatus('success');

      // Update auth metadata in the background (non-blocking)
      supabase.auth
        .updateUser({
          data: {
            full_name: toNull(fullName),
            name: toNull(displayName) ?? toNull(fullName),
            avatar_url: toNull(avatarUrl),
          },
        })
        .catch((err) => {
          console.warn('Auth metadata update failed (non-critical):', err);
        });

      // Refresh page data
      router.refresh();

      // CHANGE: Close dialog after success state is visible (1500ms for visibility)
      setTimeout(() => {
        setDialogOpen(false);
        setIsSaving(false);
        setSaveStatus('idle');
      }, 1500);
    } catch (error: unknown) {
      setSaveStatus('error');
      setErrorMessage(getErrorMessage(error));
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setFullName(initialProfile.fullName);
    setDisplayName(initialProfile.displayName);
    setPhone(initialProfile.phone);
    setAvatarUrl(initialProfile.avatarUrl);
    setProfileCompleted(initialProfile.profileCompleted);
    setUpdatedAt(initialProfile.updatedAt);
    setPhoneFieldError(null);
    setFocusedField(null);
    setValidFlashField(null);
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsEditing(false);
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setSaveStatus('idle');
    setErrorMessage(null);
    setSuccessMessage(null);

    const normalizedPhone = phone.trim();
    const nextPhoneError = validatePhoneField(phone);
    setPhoneFieldError(nextPhoneError);
    if (nextPhoneError) {
      setErrorMessage(nextPhoneError);
      setSaveStatus('error');
      setIsSaving(false);
      return;
    }

    const nextProfileCompleted = Boolean(fullName.trim() && normalizedPhone);

    try {
      const supabase = createClient();
      const now = new Date().toISOString();

      const profileData = {
        full_name: toNull(fullName),
        display_name: toNull(displayName),
        phone: toNull(phone),
        avatar_url: toNull(avatarUrl),
        profile_completed: nextProfileCompleted,
        updated_at: now,
      };

      console.log('📝 Save attempt:', {
        userId,
        hasProfileRecord,
        profileData,
        formValues: { fullName, displayName, phone, avatarUrl },
      });

      let profileError = null;
      let saveResult = null;

      // Try to update existing record
      if (hasProfileRecord) {
        const result = await supabase
          .from('users_profile')
          .update(profileData)
          .eq('user_id', userId);

        profileError = result.error;
        saveResult = result;
        console.log('UPDATE result:', {
          data: result.data,
          error: result.error,
          status: result.status,
        });
      } else {
        // No existing record, try to insert
        const result = await supabase.from('users_profile').insert({
          user_id: userId,
          role: role,
          ...profileData,
        });

        profileError = result.error;
        saveResult = result;
        console.log('INSERT result:', {
          data: result.data,
          error: result.error,
          status: result.status,
        });
      }

      if (profileError) {
        console.error('Profile save error:', profileError);
        throw profileError;
      }

      // Check for silent failures
      if (!saveResult) {
        throw new Error('Unexpected: No result returned from database operation');
      }

      // Profile saved successfully
      setProfileCompleted(nextProfileCompleted);
      setUpdatedAt(now);
      setIsEditing(false);
      setSuccessMessage('Profile updated successfully.');
      setSaveStatus('success');

      // Update auth metadata in the background (non-blocking)
      supabase.auth
        .updateUser({
          data: {
            full_name: toNull(fullName),
            name: toNull(displayName) ?? toNull(fullName),
            avatar_url: toNull(avatarUrl),
          },
        })
        .catch((err) => {
          console.warn('Auth metadata update failed (non-critical):', err);
        });

      // Refresh page data
      router.refresh();

      setTimeout(() => {
        setDialogOpen(false);
      }, 500);
    } catch (error: unknown) {
      setSaveStatus('error');
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleResendVerification = async () => {
    setIsResending(true);
    setVerificationMessage(null);
    setErrorMessage(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resend({ type: 'signup', email });

      if (error) {
        throw error;
      }

      setVerificationMessage('Verification email sent. Please check your inbox.');
    } catch (error: unknown) {
      setVerificationMessage(getErrorMessage(error));
    } finally {
      setIsResending(false);
    }
  };

  return (
    // ANIMATION: Form container enters with subtle fade-up to establish hierarchy.
    <motion.div
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={fadeVariants}
      style={{ willChange: 'transform, opacity' }}
    >
      <Card className="overflow-hidden border-pink-200/80 bg-linear-to-br from-rose-50 via-background to-amber-50/70 shadow-md dark:border-pink-500/30 dark:from-rose-950/25 dark:via-background dark:to-amber-950/20">
        <CardHeader className="space-y-5 bg-[radial-gradient(circle_at_top_right,rgba(244,114,182,0.14),transparent_45%),radial-gradient(circle_at_bottom_left,rgba(251,191,36,0.14),transparent_40%)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 border-2 border-pink-200 shadow-sm dark:border-pink-500/40">
                {avatarUrl.trim() ? (
                  <AvatarImage src={avatarUrl.trim()} alt={identityName} />
                ) : null}
                <AvatarFallback className="text-base font-semibold">{initials}</AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-2xl text-rose-700 dark:text-rose-200">
                    {identityName}
                  </CardTitle>
                  {!isEditing ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setIsEditing(true)}
                      disabled={!canEdit}
                      aria-label="Edit profile"
                      title="Edit profile"
                      className="rounded-full border border-pink-200 bg-white/80 text-rose-600 hover:bg-pink-100 hover:text-rose-700 dark:border-pink-500/40 dark:bg-rose-900/20 dark:text-rose-200 dark:hover:bg-rose-900/40"
                    >
                      <Pencil />
                    </Button>
                  ) : null}
                </div>
                <CardDescription>{email}</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="secondary"
                className="rounded-full border-pink-200 bg-pink-100/80 text-rose-700 dark:border-pink-500/40 dark:bg-rose-900/30 dark:text-rose-200"
              >
                {formatRole(initialProfile.role)}
              </Badge>
              <Badge variant={profileCompleted ? 'default' : 'outline'} className="rounded-full">
                {profileCompleted ? 'Profile complete' : 'Profile incomplete'}
              </Badge>
            </div>
          </div>

          <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
            <div className="rounded-xl border border-pink-100 bg-white/70 px-3 py-2 shadow-sm dark:border-pink-500/20 dark:bg-rose-950/10">
              <p className="text-xs uppercase tracking-wide">Account Email</p>
              <p className="mt-1 font-medium text-foreground">{email}</p>
            </div>
            <div className="rounded-xl border border-pink-100 bg-white/70 px-3 py-2 shadow-sm dark:border-pink-500/20 dark:bg-rose-950/10">
              <p className="text-xs uppercase tracking-wide">Last Updated</p>
              <p className="mt-1 font-medium text-foreground">{lastUpdated}</p>
            </div>
            <div className="rounded-xl border border-pink-100 bg-white/70 px-3 py-2 shadow-sm dark:border-pink-500/20 dark:bg-rose-950/10">
              <p className="text-xs uppercase tracking-wide">User ID</p>
              <p className="mt-1 truncate font-medium text-foreground">{userId}</p>
            </div>
          </div>
        </CardHeader>

        <Separator />

        <CardContent className="pt-6">
          {!emailConfirmed ? (
            <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              <p>Email is not verified. Verify your email to unlock profile access.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleResendVerification}
                  disabled={isResending}
                >
                  {isResending ? 'Sending...' : 'Resend verification email'}
                </Button>
                {verificationMessage ? (
                  <span className="text-xs text-muted-foreground">{verificationMessage}</span>
                ) : null}
              </div>
            </div>
          ) : null}

          {!isEditing ? null : (
            // ANIMATION: Field groups stagger in for progressive readability.
            <motion.form
              ref={formRef}
              className="space-y-6"
              onSubmit={handleSubmitRequest}
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={staggerVariants}
            >
              <motion.div className="grid gap-4 sm:grid-cols-2" variants={staggerVariants}>
                <motion.div className="grid gap-2" variants={fadeVariants}>
                  <Label
                    htmlFor="fullName"
                    // ANIMATION: Label gently shifts to reinforce focused field context.
                    className="origin-left transition-transform duration-150"
                    style={{
                      transform:
                        focusedField === 'fullName'
                          ? 'translateY(-1px) scale(0.98)'
                          : 'translateY(0) scale(1)',
                    }}
                  >
                    Full name
                  </Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    disabled={isSaving}
                    onChange={(event) => setFullName(event.target.value)}
                    onFocus={() => setFocusedField('fullName')}
                    onBlur={(event) => handleFieldBlur('fullName', event.target.value)}
                    placeholder="Enter your full name"
                    maxLength={255}
                    className={getInputMotionClassName('fullName')}
                  />
                </motion.div>

                <motion.div className="grid gap-2" variants={fadeVariants}>
                  <Label
                    htmlFor="displayName"
                    // ANIMATION: Label gently shifts to reinforce focused field context.
                    className="origin-left transition-transform duration-150"
                    style={{
                      transform:
                        focusedField === 'displayName'
                          ? 'translateY(-1px) scale(0.98)'
                          : 'translateY(0) scale(1)',
                    }}
                  >
                    Display name
                  </Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    disabled={isSaving}
                    onChange={(event) => setDisplayName(event.target.value)}
                    onFocus={() => setFocusedField('displayName')}
                    onBlur={(event) => handleFieldBlur('displayName', event.target.value)}
                    placeholder="How should others see your name?"
                    maxLength={100}
                    className={getInputMotionClassName('displayName')}
                  />
                </motion.div>

                <motion.div className="grid gap-2" variants={fadeVariants} layout>
                  <Label
                    htmlFor="phone"
                    // ANIMATION: Label gently shifts to reinforce focused field context.
                    className="origin-left transition-transform duration-150"
                    style={{
                      transform:
                        focusedField === 'phone'
                          ? 'translateY(-1px) scale(0.98)'
                          : 'translateY(0) scale(1)',
                    }}
                  >
                    Phone number
                  </Label>
                  <Input
                    id="phone"
                    value={phone}
                    disabled={isSaving}
                    onChange={(event) => {
                      setPhone(event.target.value);
                      if (phoneFieldError) {
                        setPhoneFieldError(validatePhoneField(event.target.value));
                      }
                    }}
                    onFocus={() => setFocusedField('phone')}
                    onBlur={(event) => handleFieldBlur('phone', event.target.value)}
                    placeholder="e.g. +880 17XX-XXXXXX"
                    maxLength={20}
                    className={getInputMotionClassName('phone')}
                  />
                  <AnimatePresence>
                    {phoneFieldError ? (
                      // ANIMATION: Validation error appears with layout + fade-up for clear feedback.
                      <motion.p
                        key="phone-field-error"
                        layout
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        variants={validationMessageVariants}
                        className="text-sm text-red-600"
                      >
                        {phoneFieldError}
                      </motion.p>
                    ) : null}
                  </AnimatePresence>
                </motion.div>

                <motion.div className="grid gap-2" variants={fadeVariants}>
                  <Label
                    htmlFor="avatarUrl"
                    // ANIMATION: Label gently shifts to reinforce focused field context.
                    className="origin-left transition-transform duration-150"
                    style={{
                      transform:
                        focusedField === 'avatarUrl'
                          ? 'translateY(-1px) scale(0.98)'
                          : 'translateY(0) scale(1)',
                    }}
                  >
                    Avatar URL
                  </Label>
                  <Input
                    id="avatarUrl"
                    value={avatarUrl}
                    disabled={isSaving}
                    onChange={(event) => setAvatarUrl(event.target.value)}
                    onFocus={() => setFocusedField('avatarUrl')}
                    onBlur={(event) => handleFieldBlur('avatarUrl', event.target.value)}
                    placeholder="https://example.com/avatar.png"
                    className={getInputMotionClassName('avatarUrl')}
                  />
                </motion.div>
              </motion.div>

              <AnimatePresence mode="wait">
                {errorMessage ? (
                  // ANIMATION: Error message enters with slide/fade and a subtle shake to draw attention.
                  <motion.div
                    key="profile-error-wrap"
                    animate={shouldReduceMotion ? undefined : { x: [0, -4, 4, -4, 4, -2, 2, 0] }}
                    transition={{ duration: 0.4 }}
                  >
                    <motion.p
                      key="profile-error"
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      variants={messageVariants}
                      className="text-sm text-red-600"
                    >
                      {errorMessage}
                    </motion.p>
                  </motion.div>
                ) : null}

                {!errorMessage && successMessage ? (
                  // ANIMATION: Success feedback slides in softly then auto-dismisses.
                  <motion.p
                    key="profile-success"
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    variants={messageVariants}
                    className="text-sm text-emerald-600"
                  >
                    {successMessage}
                  </motion.p>
                ) : null}
              </AnimatePresence>

              <div className="flex flex-wrap gap-2">
                {/* ANIMATION: Save button uses tactile hover/press scaling and smooth state transitions. */}
                <motion.div
                  whileHover={shouldReduceMotion ? undefined : { scale: 1.02 }}
                  whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                >
                  <Button
                    ref={saveButtonRef}
                    type="submit"
                    disabled={isSaving}
                    className="transition-colors duration-150"
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      {isSaving ? (
                        <motion.span
                          key="save-loading"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="inline-flex items-center gap-2"
                        >
                          {/* ANIMATION: Loader rotates continuously only during active save. */}
                          <motion.span
                            animate={{ rotate: 360 }}
                            transition={spinnerTransition}
                            className="inline-flex"
                          >
                            <Loader2 className="h-4 w-4" aria-hidden="true" />
                          </motion.span>
                          Saving...
                        </motion.span>
                      ) : saveStatus === 'success' ? (
                        <motion.span
                          key="save-success"
                          initial="hidden"
                          animate="visible"
                          exit="exit"
                          variants={successCheckVariants}
                          className="inline-flex items-center gap-2"
                        >
                          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                          Saved
                        </motion.span>
                      ) : (
                        <motion.span
                          key="save-idle"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                        >
                          Save changes
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </Button>
                </motion.div>
                <Button type="button" variant="outline" onClick={handleCancel} disabled={isSaving}>
                  Cancel
                </Button>
              </div>

              {/* ANIMATION: Dialog with AnimatePresence for exit animation control */}
              <AnimatePresence mode="wait">
                {dialogOpen && (
                  <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
                    {/* ANIMATION: DialogContent wraps in motion.div for spring entry + fast exit */}
                    <motion.div
                      key="dialog-modal"
                      variants={dialogModalVar}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      style={{ willChange: 'transform, opacity' }}
                    >
                      <DialogContent
                        className="data-[state=open]:animate-none data-[state=closed]:animate-none"
                        onOpenAutoFocus={(event) => {
                          event.preventDefault();
                          cancelButtonRef.current?.focus();
                        }}
                      >
                        {/* ANIMATION: Dialog panel scales/fades for smooth modal depth transition. */}
                        <motion.div
                          initial="hidden"
                          animate="visible"
                          exit="exit"
                          variants={dialogPanelVariants}
                          style={{ willChange: 'transform, opacity' }}
                        >
                          {/* ANIMATION: Dialog content children stagger in to guide reading order. */}
                          <motion.div
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            variants={dialogContentStaggerVariants}
                          >
                            <motion.div variants={dialogContentItemVariants}>
                              <DialogHeader>
                                <DialogTitle>Save changes?</DialogTitle>
                                <DialogDescription>
                                  You are about to update your profile. This will be saved to your
                                  account immediately.
                                </DialogDescription>
                              </DialogHeader>
                            </motion.div>

                            <motion.div variants={dialogContentItemVariants} className="space-y-3">
                              <p className="text-sm font-medium text-foreground">Summary</p>
                              {changedFields.length > 0 ? (
                                <ul className="space-y-2 text-sm text-muted-foreground">
                                  {changedFields.map((field) => (
                                    <li
                                      key={field.label}
                                      className="rounded-md border bg-muted/40 px-3 py-2"
                                    >
                                      <span className="font-medium text-foreground">
                                        {field.label}:
                                      </span>{' '}
                                      {field.after.trim() || 'Empty'}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-sm text-muted-foreground">
                                  No field changes detected.
                                </p>
                              )}

                              <AnimatePresence mode="wait">
                                {saveStatus === 'success' ? (
                                  <motion.p
                                    key="dialog-success"
                                    initial="hidden"
                                    animate="visible"
                                    exit="exit"
                                    variants={messageVariants}
                                    className="flex items-center gap-2 text-sm text-emerald-600"
                                  >
                                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                                    Profile updated successfully.
                                  </motion.p>
                                ) : null}

                                {saveStatus === 'error' && errorMessage ? (
                                  <motion.p
                                    key="dialog-error"
                                    initial="hidden"
                                    animate="visible"
                                    exit="exit"
                                    variants={messageVariants}
                                    className="flex items-center gap-2 text-sm text-red-600"
                                  >
                                    <AlertCircle className="h-4 w-4" aria-hidden="true" />
                                    {errorMessage}
                                  </motion.p>
                                ) : null}
                              </AnimatePresence>
                            </motion.div>

                            <motion.div variants={dialogContentItemVariants} className="pt-6">
                              <DialogFooter>
                                <Button
                                  ref={cancelButtonRef}
                                  type="button"
                                  variant="outline"
                                  onClick={() => handleDialogOpenChange(false)}
                                >
                                  Cancel
                                </Button>
                                <motion.div
                                  whileHover={shouldReduceMotion ? undefined : { scale: 1.02 }}
                                  whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
                                  transition={{ duration: 0.1 }}
                                >
                                  <Button
                                    type="button"
                                    onClick={handleConfirmSave}
                                    disabled={isSaving}
                                    variant={saveStatus === 'error' ? 'destructive' : 'default'}
                                  >
                                    <AnimatePresence mode="wait" initial={false}>
                                      {/* CHANGE: Show spinner + "Saving..." when saving */}
                                      {isSaving && saveStatus === 'idle' && (
                                        <motion.span
                                          key="dialog-saving"
                                          initial={{ opacity: 0 }}
                                          animate={{ opacity: 1 }}
                                          exit={{ opacity: 0 }}
                                          className="inline-flex items-center gap-2"
                                        >
                                          <motion.span
                                            animate={{ rotate: 360 }}
                                            transition={spinnerTransition}
                                          >
                                            <Loader2 className="h-4 w-4" aria-hidden="true" />
                                          </motion.span>
                                          Saving...
                                        </motion.span>
                                      )}
                                      {/* CHANGE: Show check + "Saved!" on success */}
                                      {saveStatus === 'success' && (
                                        <motion.span
                                          key="dialog-saved"
                                          initial="hidden"
                                          animate="visible"
                                          exit="exit"
                                          variants={successCheckVariants}
                                          className="inline-flex items-center gap-2"
                                        >
                                          <Check className="h-4 w-4" aria-hidden="true" />
                                          Saved!
                                        </motion.span>
                                      )}
                                      {/* CHANGE: Show "Confirm" when idle or on error */}
                                      {!isSaving && saveStatus === 'idle' && (
                                        <motion.span
                                          key="dialog-idle"
                                          initial={{ opacity: 0 }}
                                          animate={{ opacity: 1 }}
                                          exit={{ opacity: 0 }}
                                        >
                                          Confirm
                                        </motion.span>
                                      )}
                                      {saveStatus === 'error' && (
                                        <motion.span
                                          key="dialog-error-button"
                                          initial={{ opacity: 0 }}
                                          animate={{ opacity: 1 }}
                                          exit={{ opacity: 0 }}
                                        >
                                          Confirm
                                        </motion.span>
                                      )}
                                    </AnimatePresence>
                                  </Button>
                                </motion.div>
                              </DialogFooter>
                              {/* CHANGE: Show error message below buttons when save fails */}
                              <AnimatePresence mode="wait">
                                {saveStatus === 'error' && (
                                  <motion.p
                                    key="dialog-footer-error"
                                    initial="hidden"
                                    animate="visible"
                                    exit="exit"
                                    variants={messageVariants}
                                    className="text-sm text-destructive mt-2"
                                  >
                                    Something went wrong. Please try again.
                                  </motion.p>
                                )}
                              </AnimatePresence>
                            </motion.div>
                          </motion.div>
                        </motion.div>
                      </DialogContent>
                    </motion.div>
                  </Dialog>
                )}
              </AnimatePresence>
            </motion.form>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import type { VariantProps } from 'class-variance-authority';
import { useRouter } from 'next/navigation';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { createClient } from '@/lib/supabase/client';

type SellerUpgradeCtaProps = {
  isAuthenticated: boolean;
  userId?: string | null;
  userRole?: string | null;
  children?: ReactNode;
  buttonClassName?: string;
  buttonVariant?: VariantProps<typeof buttonVariants>['variant'];
  buttonSize?: VariantProps<typeof buttonVariants>['size'];
};

export function SellerUpgradeCta({
  isAuthenticated,
  userId,
  userRole,
  children,
  buttonClassName,
  buttonVariant = 'link',
  buttonSize = 'default',
}: SellerUpgradeCtaProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requiresSignIn, setRequiresSignIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && isSubmitting) {
      return;
    }

    setIsOpen(nextOpen);
    if (nextOpen) {
      setErrorMessage(null);
    }
  };

  const handleTriggerClick = async () => {
    if (isSubmitting || isCheckingAuth) {
      return;
    }

    setIsOpen(true);
    setErrorMessage(null);
    setRequiresSignIn(false);

    const hasKnownBuyerSession = userRole === 'buyer' || isAuthenticated;

    if (hasKnownBuyerSession) {
      return;
    }

    setIsCheckingAuth(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.getUser();
      const sessionUser = data.user;

      if (error || !sessionUser?.id) {
        setRequiresSignIn(true);
      }
    } finally {
      setIsCheckingAuth(false);
    }
  };

  const handleConfirmUpgrade = async () => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const supabase = createClient();
      let resolvedUserId = userId;

      if (!resolvedUserId) {
        const { data, error } = await supabase.auth.getSession();
        const sessionUser = data.session?.user;

        if (error || !sessionUser?.id) {
          throw new Error('Unable to verify your account. Please sign in again.');
        }

        resolvedUserId = sessionUser.id;
      }

      const { data: existingProfile, error: existingProfileError } = await supabase
        .from('users_profile')
        .select('role')
        .eq('user_id', resolvedUserId)
        .maybeSingle();

      if (existingProfileError) {
        throw existingProfileError;
      }

      if (existingProfile?.role === 'admin' || existingProfile?.role === 'moderator') {
        setIsOpen(false);
        router.replace('/');
        router.refresh();
        return;
      }

      const { error: profileError } = await supabase
        .from('users_profile')
        .upsert({ user_id: resolvedUserId, role: 'seller' }, { onConflict: 'user_id' });

      if (profileError) {
        throw profileError;
      }

      await supabase.auth.updateUser({
        data: {
          role: 'seller',
        },
      });

      setIsOpen(false);
      router.replace('/seller');
      router.refresh();
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to switch roles.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <Button
        type="button"
        variant={buttonVariant}
        size={buttonSize}
        className={
          buttonClassName ?? 'h-auto p-0 font-semibold text-primary'
        }
        onClick={handleTriggerClick}
        disabled={isCheckingAuth || isSubmitting}
      >
        {isCheckingAuth ? 'Checking account...' : children ?? 'Sign up as a seller'}
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {requiresSignIn ? 'Sign in to become a seller' : 'Switch to a seller account?'}
          </DialogTitle>
          <DialogDescription>
            {requiresSignIn
              ? 'Sign in to confirm your account before enabling seller tools.'
              : 'We will update your profile so you can access seller tools and publish products.'}
          </DialogDescription>
        </DialogHeader>

        {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

        <DialogFooter>
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              No
            </Button>
            <Button type="button" onClick={handleConfirmUpgrade} disabled={isSubmitting}>
              {isSubmitting ? 'Switching...' : 'Yes'}
            </Button>
          </>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

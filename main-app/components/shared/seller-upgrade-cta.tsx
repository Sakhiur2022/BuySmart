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
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const handleTriggerClick = () => {
    if (isSubmitting) {
      return;
    }

    setIsOpen(true);
    setErrorMessage(null);
  };

  const handleConfirmUpgrade = async () => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/seller/upgrade', { method: 'POST' });

      if (response.status === 401) {
        setIsOpen(false);
        router.push('/auth/seller-sign-up');
        return;
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.includes('application/json')) {
        setIsOpen(false);
        router.push('/auth/seller-sign-up');
        return;
      }

      const payload = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || !payload.ok) {
        if (payload.error === 'admin_or_moderator') {
          setIsOpen(false);
          router.replace('/');
          router.refresh();
          return;
        }
        throw new Error(payload.error || 'Unable to upgrade to seller.');
      }

      setIsOpen(false);
      router.replace('/seller');
      router.refresh();
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Unable to upgrade to seller';
      setErrorMessage(errorMsg);
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
        disabled={isSubmitting}
      >
        {children ?? 'Sign up as a seller'}
      </Button>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold">Switch to a seller account?</DialogTitle>
          <DialogDescription>
            Continue to unlock listing tools, inventory controls, and your seller dashboard.
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
              Not now
            </Button>
            <Button type="button" onClick={handleConfirmUpgrade} disabled={isSubmitting}>
              {isSubmitting ? 'Switching...' : 'Continue'}
            </Button>
          </>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

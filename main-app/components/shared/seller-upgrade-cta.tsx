'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { createClient } from '@/lib/supabase/client';

type SellerUpgradeCtaProps = {
  isAuthenticated: boolean;
  userId?: string | null;
};

export function SellerUpgradeCta({ isAuthenticated, userId }: SellerUpgradeCtaProps) {
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
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user?.id) {
          throw new Error('Unable to verify your account. Please sign in again.');
        }
        resolvedUserId = data.user.id;
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

  if (!isAuthenticated) {
    return (
      <Link href="/auth/seller-sign-up" className="font-semibold text-primary hover:underline">
        Sign up as a seller
      </Link>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="link"
          className="h-auto p-0 font-semibold text-primary"
        >
          Sign up as a seller
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Switch to a seller account?</DialogTitle>
          <DialogDescription>
            We will update your profile so you can access seller tools and publish products.
          </DialogDescription>
        </DialogHeader>

        {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirmUpgrade} disabled={isSubmitting}>
            {isSubmitting ? 'Switching...' : 'Confirm switch'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

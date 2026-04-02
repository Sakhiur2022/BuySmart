'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { createClient } from '@/lib/supabase/client';

const LOADING_MESSAGE = 'Checking your account...';

type SellerUpgradeGateProps = {
  children: ReactNode;
};

type SessionStatus = 'checking' | 'authenticated' | 'anonymous';

export function SellerUpgradeGate({ children }: SellerUpgradeGateProps) {
  const router = useRouter();
  const [status, setStatus] = useState<SessionStatus>('checking');
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let isMounted = true;

    const checkSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      const sessionUser = data.session?.user;

      if (!isMounted) {
        return;
      }

      if (error || !sessionUser?.id) {
        setStatus('anonymous');
        setUserId(null);
        setUserEmail(null);
        return;
      }

      setUserId(sessionUser.id);
      setUserEmail(sessionUser.email ?? null);
      setStatus('authenticated');
    };

    void checkSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && isSubmitting) {
      return;
    }

    setIsOpen(nextOpen);
    if (!nextOpen) {
      router.back();
    }
  };

  const handleConfirmUpgrade = async () => {
    if (isSubmitting || !userId) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const supabase = createClient();
      const { data: existingProfile, error: existingProfileError } = await supabase
        .from('users_profile')
        .select('role')
        .eq('user_id', userId)
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

      if (existingProfile?.role === 'seller') {
        setIsOpen(false);
        router.replace('/seller');
        router.refresh();
        return;
      }

      const { error: profileError } = await supabase
        .from('users_profile')
        .upsert({ user_id: userId, role: 'seller' }, { onConflict: 'user_id' });

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

  if (status === 'checking') {
    return <p className="text-center text-muted-foreground">{LOADING_MESSAGE}</p>;
  }

  if (status === 'anonymous') {
    return <>{children}</>;
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Switch to a seller account?</DialogTitle>
            <DialogDescription>
              We will update your profile so you can access seller tools and publish products.
            </DialogDescription>
          </DialogHeader>

          {userEmail ? (
            <p className="text-sm text-muted-foreground">Signed in as {userEmail}.</p>
          ) : null}
          {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Keep buyer account
            </Button>
            <Button type="button" onClick={handleConfirmUpgrade} disabled={isSubmitting}>
              {isSubmitting ? 'Switching...' : 'Confirm switch'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { clearChatbotSessionStorage } from '@/lib/chatbot/session';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { OAuthProviderButtons } from '@/app/(auth)/components/oauth-provider-buttons';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getLoginErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Unable to sign in.';
  }

  const message = error.message.toLowerCase();

  if (message.includes('invalid login credentials')) {
    return 'Email or password is incorrect. If you do not have an account yet, please sign up.';
  }

  if (message.includes('email not confirmed')) {
    return 'Please confirm your email address before signing in.';
  }

  return error.message;
}

export function LoginForm({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sellerErrorCode = searchParams.get('seller_error');
  const sellerAccessMessage =
    sellerErrorCode === 'admin_or_moderator_cannot_be_seller'
      ? "Admin or moderator can't be a seller."
      : null;
  const emailIsInvalid = email.length > 0 && !EMAIL_REGEX.test(email.trim());
  const passwordNeedsMoreChars = password.length > 0 && password.length < 8;
  const canSubmit = !emailIsInvalid && password.length >= 8;

  const handleEmailLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        throw signInError;
      }

      clearChatbotSessionStorage();

      const userId = data.user?.id;
      const roleFromMetadata = data.user?.user_metadata?.role;
      const normalizedMetadataRole =
        roleFromMetadata === 'seller' || roleFromMetadata === 'buyer' ? roleFromMetadata : null;
      let resolvedRole: string | null = null;

      if (userId) {
        const { data: existingProfile } = await supabase
          .from('users_profile')
          .select('role')
          .eq('user_id', userId)
          .maybeSingle();

        resolvedRole = existingProfile?.role ?? null;
      }

      const shouldPromoteBuyerToSeller =
        resolvedRole === 'buyer' && normalizedMetadataRole === 'seller';

      if (shouldPromoteBuyerToSeller && userId) {
        const { error: promoteError } = await supabase
          .from('users_profile')
          .update({ role: 'seller' })
          .eq('user_id', userId);

        if (promoteError) {
          console.warn('Buyer to seller promotion failed:', promoteError.message);
        } else {
          resolvedRole = 'seller';
        }
      }

      if (!resolvedRole && userId && normalizedMetadataRole) {
        const { error: profileError } = await supabase
          .from('users_profile')
          .upsert({ user_id: userId, role: normalizedMetadataRole }, { onConflict: 'user_id' });

        if (profileError) {
          console.warn('Profile bootstrap failed:', profileError.message);
        } else {
          resolvedRole = normalizedMetadataRole;
        }
      }

      const nextPath =
        resolvedRole === 'admin' || resolvedRole === 'moderator'
          ? '/admin'
          : resolvedRole === 'seller'
            ? '/seller'
            : '/';
      router.replace(nextPath);
      router.refresh();
    } catch (signInError: unknown) {
      setError(getLoginErrorMessage(signInError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Welcome back</CardTitle>
          <CardDescription>
            Sign in with email and password or continue with social.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-6">
            {sellerAccessMessage ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                {sellerAccessMessage}
              </div>
            ) : null}

            <form className="flex flex-col gap-4" onSubmit={handleEmailLogin} autoComplete="on">
              <div className="grid gap-2">
                <Label htmlFor="loginEmail">Email</Label>
                <Input
                  id="loginEmail"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="m@example.com"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  inputMode="email"
                  required
                  disabled={isSubmitting}
                />
                {emailIsInvalid ? (
                  <p className="text-xs text-amber-600" aria-live="polite">
                    Enter a valid email format (example: name@example.com).
                  </p>
                ) : null}
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="loginPassword">Password</Label>
                  <Link
                    href="/auth/forgot-password"
                    className="text-xs text-muted-foreground underline underline-offset-4"
                  >
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="loginPassword"
                  name="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  disabled={isSubmitting}
                />
                {passwordNeedsMoreChars ? (
                  <p className="text-xs text-amber-600" aria-live="polite">
                    Password must be at least 8 characters ({password.length}/8).
                  </p>
                ) : null}
              </div>

              {error ? <p className="text-sm text-red-600">{error}</p> : null}

              <Button type="submit" className="w-full" disabled={isSubmitting || !canSubmit}>
                {isSubmitting ? 'Signing in...' : 'Sign in with email'}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                Don&apos;t have an account?{' '}
                <Link href="/auth/sign-up" className="underline underline-offset-4">
                  Sign up
                </Link>
              </p>
            </form>

            <div className="space-y-4">
              <div className="relative">
                <Separator />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                  OR CONTINUE WITH
                </span>
              </div>
              <Suspense fallback={<p className="text-sm text-muted-foreground">Loading...</p>}>
                <OAuthProviderButtons defaultNextPath="/" />
              </Suspense>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

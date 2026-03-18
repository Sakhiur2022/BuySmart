'use client';

import { Suspense } from 'react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { createClient } from '@/lib/supabase/client';
import { OAuthProviderButtons } from '@/app/(auth)/components/oauth-provider-buttons';

export function SignUpForm({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordNeedsMoreChars = password.length > 0 && password.length < 8;
  const passwordMismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const canSubmit =
    email.trim().length > 0 && password.length >= 8 && confirmPassword.length > 0 && !passwordMismatch;

  const handleEmailSignUp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Password and confirmation do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/confirm?next=/`;

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: redirectTo,
        },
      });

      if (signUpError) {
        throw signUpError;
      }

      if (data.session) {
        router.replace('/');
      } else {
        router.replace('/auth/sign-up-success');
      }

      router.refresh();
    } catch (signUpError: unknown) {
      setError(signUpError instanceof Error ? signUpError.message : 'Unable to create account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Create your account</CardTitle>
          <CardDescription>Create an account with email and password or use social.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-6">
            <form className="flex flex-col gap-4" onSubmit={handleEmailSignUp}>
              <div className="grid gap-2">
                <Label htmlFor="signUpEmail">Email</Label>
                <Input
                  id="signUpEmail"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="m@example.com"
                  autoComplete="email"
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="signUpPassword">Password</Label>
                <Input
                  id="signUpPassword"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  disabled={isSubmitting}
                />
                {passwordNeedsMoreChars ? (
                  <p className="text-xs text-amber-600" aria-live="polite">
                    Password must be at least 8 characters ({password.length}/8).
                  </p>
                ) : null}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="signUpConfirmPassword">Confirm password</Label>
                <Input
                  id="signUpConfirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Re-enter your password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  disabled={isSubmitting}
                />
                {passwordMismatch ? (
                  <p className="text-xs text-amber-600" aria-live="polite">
                    Password and confirmation do not match yet.
                  </p>
                ) : null}
              </div>

              {error ? <p className="text-sm text-red-600">{error}</p> : null}

              <Button type="submit" className="w-full" disabled={isSubmitting || !canSubmit}>
                {isSubmitting ? 'Creating account...' : 'Sign up with email'}
              </Button>
            </form>

            <div className="relative">
              <Separator />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                OR CONTINUE WITH
              </span>
            </div>

            <Suspense
              fallback={<p className="text-center text-sm text-muted-foreground">Loading...</p>}
            >
              <OAuthProviderButtons defaultNextPath="/" />
            </Suspense>
            <div className="text-center text-sm">
              Already have an account?{' '}
              <Link href="/auth/login" className="underline underline-offset-4">
                Login
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

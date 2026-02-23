'use client';

import { Suspense } from 'react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { OAuthProviderButtons } from '@/app/(auth)/components/oauth-provider-buttons';

export function SignUpForm({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Create your account</CardTitle>
          <CardDescription>Sign up with Google or Facebook</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-6">
            <Suspense
              fallback={<p className="text-center text-sm text-muted-foreground">Loading...</p>}
            >
              <OAuthProviderButtons defaultNextPath="/protected" />
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

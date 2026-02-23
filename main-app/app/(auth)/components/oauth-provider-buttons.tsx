'use client';

import { Button } from '@/components/ui/button';
import { OAUTH_PROVIDERS } from '../lib/auth-providers';
import { useAuthRedirect } from '../hooks/use-auth-redirect';
import { useOAuthLogin } from '../hooks/use-oauth-login';
import { AuthErrorDisplay } from './auth-error-display';
import { AuthLoading } from './auth-loading';

type OAuthProviderButtonsProps = {
  defaultNextPath?: string;
};

export function OAuthProviderButtons({
  defaultNextPath = '/protected',
}: OAuthProviderButtonsProps) {
  const { nextPath } = useAuthRedirect(defaultNextPath);
  const { signInWithProvider, isLoading, error, activeProvider } = useOAuthLogin(nextPath);

  return (
    <div className="flex flex-col gap-4">
      {error ? <AuthErrorDisplay message={error} /> : null}
      {OAUTH_PROVIDERS.map((provider) => (
        <Button
          key={provider.id}
          type="button"
          className="w-full"
          disabled={isLoading}
          onClick={() => signInWithProvider(provider.id)}
        >
          {isLoading && activeProvider === provider.id ? 'Redirecting...' : provider.label}
        </Button>
      ))}
      {isLoading ? <AuthLoading /> : null}
    </div>
  );
}

import type { OAuthProvider } from '../types/auth';
import { OAUTH_PROVIDERS } from './auth-providers';
import { buildOAuthRedirectUrl } from './auth-utils';

type OAuthSignInOptions = {
  provider: OAuthProvider;
  options: {
    redirectTo: string;
    scopes?: string;
    queryParams?: Record<string, string>;
  };
};

export const getOAuthSignInOptions = (
  provider: OAuthProvider,
  nextPath: string,
): OAuthSignInOptions | null => {
  const config = OAUTH_PROVIDERS.find((item) => item.id === provider);
  const redirectTo = buildOAuthRedirectUrl(nextPath);

  if (!config || !redirectTo) {
    return null;
  }

  return {
    provider,
    options: {
      redirectTo,
      ...(config.scopes ? { scopes: config.scopes } : {}),
      ...(config.queryParams ? { queryParams: config.queryParams } : {}),
    },
  };
};

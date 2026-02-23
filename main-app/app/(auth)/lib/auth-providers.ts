import type { OAuthProviderConfig } from '../types/auth';

export const OAUTH_PROVIDERS: OAuthProviderConfig[] = [
  {
    id: 'google',
    label: 'Continue with Google',
    queryParams: { access_type: 'offline', prompt: 'consent' },
  },
  {
    id: 'facebook',
    label: 'Continue with Facebook',
    scopes: 'email',
  },
];

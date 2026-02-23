export type OAuthProvider = 'google' | 'facebook';

export type OAuthProviderConfig = {
  id: OAuthProvider;
  label: string;
  scopes?: string;
  queryParams?: Record<string, string>;
};

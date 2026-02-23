const DEFAULT_NEXT_PATH = '/';

const normalizeBaseUrl = (url: string) => (url.endsWith('/') ? url.slice(0, -1) : url);

export const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  return siteUrl ? normalizeBaseUrl(siteUrl) : '';
};

export const getSafeNextPath = (nextPath?: string | null) => {
  if (!nextPath || !nextPath.startsWith('/')) {
    return DEFAULT_NEXT_PATH;
  }

  return nextPath;
};

export const buildOAuthRedirectUrl = (nextPath: string) => {
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    return null;
  }

  const safeNextPath = getSafeNextPath(nextPath);
  const encodedNext = encodeURIComponent(safeNextPath);
  return `${baseUrl}/auth/oauth?next=${encodedNext}`;
};

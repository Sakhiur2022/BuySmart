const DEFAULT_NEXT_PATH = '/';

export const getSafeNextPath = (nextPath?: string | null) => {
  if (!nextPath || !nextPath.startsWith('/')) {
    return DEFAULT_NEXT_PATH;
  }

  return nextPath;
};

export const buildOAuthRedirectUrl = (nextPath: string) => {
  if (typeof window === 'undefined') {
    return null;
  }

  const baseUrl = window.location.origin;
  const safeNextPath = getSafeNextPath(nextPath);
  const encodedNext = encodeURIComponent(safeNextPath);
  return `${baseUrl}/auth/oauth?next=${encodedNext}`;
};

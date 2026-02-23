'use client';

import { useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSafeNextPath } from '../lib/auth-utils';

export function useAuthRedirect(defaultNextPath = '/') {
  const searchParams = useSearchParams();
  const router = useRouter();

  const nextPath = useMemo(() => {
    const nextParam = searchParams.get('next');
    return getSafeNextPath(nextParam ?? defaultNextPath);
  }, [defaultNextPath, searchParams]);

  const redirectToNext = useCallback(() => {
    router.replace(nextPath);
  }, [nextPath, router]);

  return { nextPath, redirectToNext };
}

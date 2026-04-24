import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const isProd = process.env.NODE_ENV === 'production';
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    publishableKey!,
    {
      cookieOptions: {
        secure: isProd,
        sameSite: 'lax',
        path: '/',
      },
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      },
    },
  );
}

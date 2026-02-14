import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const isProd = process.env.NODE_ENV === 'production';

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: {
        secure: isProd,
        sameSite: 'strict',
        path: '/',
      },
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    },
  );
}

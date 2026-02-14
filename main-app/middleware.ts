import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { hasEnvVars } from '@/lib/utils';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!hasEnvVars) {
    return response;
  }

  const isProd = process.env.NODE_ENV === 'production';
  const cookieOptions = {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict' as const,
    path: '/',
  };

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, {
              ...options,
              ...cookieOptions,
            }),
          );
        },
      },
    },
  );

  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = (claimsData?.claims ?? null) as Record<string, unknown> | null;
  const pathname = request.nextUrl.pathname;
  const isAuthRoute = pathname.startsWith('/auth');
  const isPublicRoute = pathname === '/' || isAuthRoute;

  const redirectTo = (targetPath: string) => {
    const url = request.nextUrl.clone();
    url.pathname = targetPath;
    url.search = '';
    const redirectResponse = NextResponse.redirect(url);
    response.cookies.getAll().forEach(({ name, value }) => {
      redirectResponse.cookies.set(name, value);
    });
    return redirectResponse;
  };

  if (!claims) {
    if (!isPublicRoute) {
      return redirectTo('/auth/login');
    }
    return response;
  }

  const emailConfirmedAt = claims.email_confirmed_at ?? claims.confirmed_at ?? null;
  const isEmailVerified = Boolean(emailConfirmedAt);

  if (!isEmailVerified && !isAuthRoute && pathname !== '/') {
    return redirectTo('/auth/sign-up-success');
  }

  const isAdminRoute = pathname.startsWith('/admin');
  const isSellerRoute = pathname.startsWith('/seller');

  if (isAdminRoute || isSellerRoute) {
    const userId = typeof claims.sub === 'string' ? claims.sub : '';
    if (!userId) {
      return redirectTo('/auth/login');
    }

    const { data: profile } = await supabase
      .from('users_profile')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();

    if (isAdminRoute && profile?.role !== 'admin') {
      return redirectTo('/auth/login');
    }

    if (isSellerRoute && profile?.role !== 'seller') {
      return redirectTo('/auth/login');
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

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
    sameSite: 'lax' as const,
    path: '/',
  };

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY!,
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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;
  const isAuthRoute = pathname.startsWith('/auth');
  const isApiRoute = pathname.startsWith('/api/');
  const isPublicAuthApi = pathname === '/api/auth/me';
  const isPublicProductApi = pathname.startsWith('/api/products');
  const isPublicRoute = pathname === '/' || isAuthRoute || isPublicAuthApi || isPublicProductApi;

  const redirectTo = (targetPath: string, params?: Record<string, string>) => {
    const url = request.nextUrl.clone();
    url.pathname = targetPath;
    url.search = '';
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }
    const redirectResponse = NextResponse.redirect(url);
    response.cookies.getAll().forEach(({ name, value }) => {
      redirectResponse.cookies.set(name, value);
    });
    return redirectResponse;
  };

  if (!user) {
    if (!isPublicRoute) {
      if (isApiRoute) {
        return NextResponse.json({ error: 'Unauthorized: Not authenticated' }, { status: 401 });
      }
      return redirectTo('/auth/login');
    }
    return response;
  }

  const isAdminRoute = pathname.startsWith('/admin');
  const isSellerRoute = pathname.startsWith('/seller');

  if (isAdminRoute || isSellerRoute) {
    const { data: profile } = await supabase
      .from('users_profile')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (isAdminRoute && profile?.role !== 'admin') {
      return redirectTo('/auth/login');
    }

    if (isSellerRoute && profile?.role !== 'seller') {
      if (profile?.role === 'admin') {
        return redirectTo('/admin');
      }

      if (profile?.role === 'moderator') {
        return redirectTo('/auth/login', {
          seller_error: 'admin_or_moderator_cannot_be_seller',
        });
      }

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

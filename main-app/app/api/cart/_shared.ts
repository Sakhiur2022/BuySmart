import { createClient } from '@/lib/supabase/server';

export async function requireAuthenticatedUser(): Promise<{ userId: string }> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error('UNAUTHENTICATED');
  }

  return { userId: user.id };
}

export function formatCartErrorResponse(error: unknown): {
  status: number;
  body: { error: string };
} {
  if (error instanceof Error) {
    if (error.message === 'UNAUTHENTICATED') {
      return { status: 401, body: { error: 'Unauthorized: Not authenticated' } };
    }

    if (error.message === 'Product not found' || error.message === 'Cart item not found') {
      return { status: 404, body: { error: error.message } };
    }

    if (
      error.message.includes('required') ||
      error.message.includes('must') ||
      error.message.includes('Invalid')
    ) {
      return { status: 400, body: { error: error.message } };
    }
  }

  return { status: 500, body: { error: 'Internal server error' } };
}

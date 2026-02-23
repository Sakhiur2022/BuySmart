'use client';

import { useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

type AuthSessionState = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
};

export function useAuthSession(): AuthSessionState {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let isActive = true;

    const loadSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (isActive) {
        setSession(data.session ?? null);
        setIsLoading(false);
      }
    };

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, updatedSession) => {
      if (isActive) {
        setSession(updatedSession);
      }
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, []);

  return { session, user: session?.user ?? null, isLoading };
}

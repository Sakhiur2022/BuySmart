'use client';

import { useCallback, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { clearChatbotSessionStorage } from '@/lib/chatbot/session';
import type { OAuthProvider } from '../types/auth';
import { getOAuthSignInOptions } from '../lib/supabase-auth';

type OAuthLoginState = {
  isLoading: boolean;
  error: string | null;
  activeProvider: OAuthProvider | null;
};

export function useOAuthLogin(nextPath: string) {
  const [state, setState] = useState<OAuthLoginState>({
    isLoading: false,
    error: null,
    activeProvider: null,
  });

  const signInWithProvider = useCallback(
    async (provider: OAuthProvider) => {
      const supabase = createClient();
      const signInOptions = getOAuthSignInOptions(provider, nextPath);

      setState({
        isLoading: true,
        error: null,
        activeProvider: provider,
      });

      if (!signInOptions) {
        setState({
          isLoading: false,
          error: 'OAuth configuration is missing.',
          activeProvider: null,
        });
        return;
      }

      clearChatbotSessionStorage();

      const { error } = await supabase.auth.signInWithOAuth(signInOptions);

      if (error) {
        setState({
          isLoading: false,
          error: error.message,
          activeProvider: null,
        });
      }
    },
    [nextPath],
  );

  return {
    signInWithProvider,
    isLoading: state.isLoading,
    error: state.error,
    activeProvider: state.activeProvider,
  };
}

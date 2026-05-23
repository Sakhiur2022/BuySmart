'use client';

import { useCallback, useMemo, useState } from 'react';

export type ChatToolStatus =
  | 'idle'
  | 'resolving_intent'
  | 'validating_payload'
  | 'invoking_tool'
  | 'awaiting_result'
  | 'completed'
  | 'failed';

export type ChatToolStatusState = {
  status: ChatToolStatus;
  error: string | null;
};

export function useChatToolStatus(initialStatus: ChatToolStatus = 'idle') {
  const [status, setStatus] = useState<ChatToolStatus>(initialStatus);
  const [error, setError] = useState<string | null>(null);

  const updateStatus = useCallback((next: ChatToolStatus) => {
    setStatus(next);
    if (next !== 'failed') {
      setError(null);
    }
  }, []);

  const fail = useCallback((message: string) => {
    setStatus('failed');
    setError(message);
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
  }, []);

  const state: ChatToolStatusState = useMemo(() => ({ status, error }), [error, status]);

  return {
    ...state,
    updateStatus,
    fail,
    reset,
  };
}

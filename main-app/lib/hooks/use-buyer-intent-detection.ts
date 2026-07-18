'use client';

import { useState, useCallback } from 'react';
import type { BuyerIntent } from '@/lib/chatbot/buyer-intent/types';
import { detectBuyerIntentWithAI, createFallbackBuyerIntent } from '@/lib/chatbot/buyer-intent/ai-detection';

export type BuyerIntentDetectionState = {
  intent: BuyerIntent | null;
  loading: boolean;
  error: string | null;
  isFallback: boolean;
};

export function useBuyerIntentDetection() {
  const [state, setState] = useState<BuyerIntentDetectionState>({
    intent: null,
    loading: false,
    error: null,
    isFallback: false,
  });

  const detectIntent = useCallback(
    async (message: string, context?: { history?: Array<{ role: string; content: string }> }) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const result = await detectBuyerIntentWithAI(message, context);

        if (result.success) {
          setState({
            intent: result.intent,
            loading: false,
            error: null,
            isFallback: false,
          });
          return result.intent;
        } else {
          // Use fallback if AI detection fails
          const fallbackIntent = createFallbackBuyerIntent(message);
          setState({
            intent: fallbackIntent,
            loading: false,
            error: result.error,
            isFallback: true,
          });
          return fallbackIntent;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Intent detection failed';
        const fallbackIntent = createFallbackBuyerIntent(message);
        setState({
          intent: fallbackIntent,
          loading: false,
          error: errorMessage,
          isFallback: true,
        });
        return fallbackIntent;
      }
    },
    []
  );

  const reset = useCallback(() => {
    setState({
      intent: null,
      loading: false,
      error: null,
      isFallback: false,
    });
  }, []);

  return {
    ...state,
    detectIntent,
    reset,
  };
}

/**
 * Hook for integrating AI intent detection with chat API calls
 * This combines intent detection with the chat API in a single flow
 */
export function useChatWithIntentDetection() {
  const [state, setState] = useState<BuyerIntentDetectionState>({
    intent: null,
    loading: false,
    error: null,
    isFallback: false,
  });

  const [chatResponse, setChatResponse] = useState<any>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const sendMessageWithIntent = useCallback(
    async (
      message: string,
      context?: {
        history?: Array<{ role: string; content: string }>;
        category?: string | null;
        price_max?: number | null;
        lastOrderId?: string | null;
      }
    ) => {
      // Step 1: Detect intent
      setState((prev) => ({ ...prev, loading: true, error: null }));
      
      try {
        const intentResult = await detectBuyerIntentWithAI(message, context);
        
        let finalIntent: BuyerIntent;
        if (intentResult.success) {
          finalIntent = intentResult.intent;
          setState({
            intent: finalIntent,
            loading: false,
            error: null,
            isFallback: false,
          });
        } else {
          finalIntent = createFallbackBuyerIntent(message);
          setState({
            intent: finalIntent,
            loading: false,
            error: intentResult.error,
            isFallback: true,
          });
        }

        // Step 2: Send to chat API with intentOutput
        setChatLoading(true);
        setChatError(null);

        const response = await fetch('/api/buyer/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message,
            context,
            intentOutput: finalIntent, // This enables AI-powered intent resolution
          }),
        });

        if (!response.ok) {
          throw new Error(`Chat API error: ${response.status}`);
        }

        const data = await response.json();
        setChatResponse(data);
        setChatLoading(false);

        return data;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Chat request failed';
        setState((prev) => ({ ...prev, loading: false, error: errorMessage }));
        setChatError(errorMessage);
        setChatLoading(false);
        throw error;
      }
    },
    []
  );

  const reset = useCallback(() => {
    setState({
      intent: null,
      loading: false,
      error: null,
      isFallback: false,
    });
    setChatResponse(null);
    setChatLoading(false);
    setChatError(null);
  }, []);

  return {
    // Intent detection state
    intent: state.intent,
    intentLoading: state.loading,
    intentError: state.error,
    isFallbackIntent: state.isFallback,
    
    // Chat state
    chatResponse,
    chatLoading,
    chatError,
    
    // Actions
    sendMessageWithIntent,
    reset,
  };
}
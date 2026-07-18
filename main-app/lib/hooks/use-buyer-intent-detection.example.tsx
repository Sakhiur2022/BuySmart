'use client';

/**
 * Example component demonstrating AI-powered buyer intent detection
 * 
 * This shows how to integrate the enhanced chat system with AI intent detection
 * into a React component for the buyer chat interface.
 */

import { useState } from 'react';
import { useChatWithIntentDetection } from '@/lib/hooks/use-buyer-intent-detection';

export function BuyerChatWithAI() {
  const [message, setMessage] = useState('');
  const [context, setContext] = useState({
    category: null as string | null,
    price_max: null as number | null,
    lastOrderId: null as string | null,
  });

  const {
    intent,
    intentLoading,
    intentError,
    isFallbackIntent,
    chatResponse,
    chatLoading,
    chatError,
    sendMessageWithIntent,
    reset,
  } = useChatWithIntentDetection();

  const handleSendMessage = async () => {
    if (!message.trim()) return;

    try {
      await sendMessageWithIntent(message, {
        category: context.category,
        price_max: context.price_max,
        lastOrderId: context.lastOrderId,
        history: [], // Would be populated with actual conversation history
      });
      setMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleReset = () => {
    reset();
    setContext({
      category: null,
      price_max: null,
      lastOrderId: null,
    });
  };

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold mb-4">BuySmart Buyer Chat (AI-Powered)</h2>
        
        {/* Intent Detection Status */}
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <h3 className="font-semibold text-sm text-gray-700 mb-2">Intent Detection Status</h3>
          {intentLoading && (
            <div className="text-blue-600 text-sm">Detecting intent with AI...</div>
          )}
          {intent && (
            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">Intent:</span>
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                  {intent.intent}
                </span>
                {isFallbackIntent && (
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">
                    Fallback
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">Confidence:</span>
                <span>
                  {intent.metadata?.confidenceScore 
                    ? `${(intent.metadata.confidenceScore * 100).toFixed(0)}%` 
                    : 'N/A'}
                </span>
              </div>
              {intent.metadata?.isPartial && (
                <div className="text-yellow-600">Partial match - may need clarification</div>
              )}
            </div>
          )}
          {intentError && (
            <div className="text-red-600 text-sm">Error: {intentError}</div>
          )}
        </div>

        {/* Chat Response */}
        {chatResponse && (
          <div className="mb-4 p-3 bg-green-50 rounded-lg">
            <h3 className="font-semibold text-sm text-gray-700 mb-2">Response</h3>
            <div className="text-sm">{chatResponse.reply}</div>
            {chatResponse.products && chatResponse.products.length > 0 && (
              <div className="mt-2">
                <div className="text-xs text-gray-600 mb-1">
                  Found {chatResponse.products.length} products
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {chatResponse.products.map((product: any) => (
                    <div
                      key={product.id}
                      className="flex-shrink-0 w-32 p-2 bg-white rounded border text-xs"
                    >
                      <div className="font-medium truncate">{product.name}</div>
                      <div className="text-gray-600">BDT {product.price.toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {chatResponse.order && (
              <div className="mt-2 p-2 bg-white rounded border text-xs">
                <div className="font-medium">Order: {chatResponse.order.id}</div>
                <div className="text-gray-600">Status: {chatResponse.order.status}</div>
              </div>
            )}
          </div>
        )}

        {chatError && (
          <div className="mb-4 p-3 bg-red-50 rounded-lg text-red-600 text-sm">
            Error: {chatError}
          </div>
        )}

        {/* Context Controls */}
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <h3 className="font-semibold text-sm text-gray-700 mb-2">Context (Optional)</h3>
          <div className="grid grid-cols-3 gap-2">
            <input
              type="text"
              placeholder="Category (e.g., phone)"
              value={context.category || ''}
              onChange={(e) => setContext({ ...context, category: e.target.value || null })}
              className="px-2 py-1 border rounded text-sm"
            />
            <input
              type="number"
              placeholder="Max Price"
              value={context.price_max || ''}
              onChange={(e) => setContext({ ...context, price_max: e.target.value ? Number(e.target.value) : null })}
              className="px-2 py-1 border rounded text-sm"
            />
            <input
              type="text"
              placeholder="Order ID"
              value={context.lastOrderId || ''}
              onChange={(e) => setContext({ ...context, lastOrderId: e.target.value || null })}
              className="px-2 py-1 border rounded text-sm"
            />
          </div>
        </div>

        {/* Message Input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Type your message..."
            disabled={chatLoading || intentLoading}
            className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <button
            onClick={handleSendMessage}
            disabled={chatLoading || intentLoading || !message.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {chatLoading || intentLoading ? 'Processing...' : 'Send'}
          </button>
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            Reset
          </button>
        </div>

        {/* Example Messages */}
        <div className="mt-4">
          <h3 className="font-semibold text-sm text-gray-700 mb-2">Try these examples:</h3>
          <div className="flex flex-wrap gap-2">
            {[
              "recommend me some products for my sibling's birthday party",
              "I need a refund for my damaged phone",
              "What's your return policy?",
              "Show me phones under 20000 BDT",
              "I want to track my order ORD-12345",
            ].map((example) => (
              <button
                key={example}
                onClick={() => setMessage(example)}
                className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs text-gray-700"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
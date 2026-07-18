# AI-Powered Buyer Intent Detection

This module provides AI-powered intent detection for the BuySmart buyer chatbot, enabling sophisticated understanding of user intentions beyond basic pattern matching.

## Features

- **AI-Powered Detection**: Uses LLM to accurately detect buyer intents
- **Multiple Intent Types**: Supports REFUND_REQUEST, PRODUCT_RECOMMENDATION, and POLICY_QA
- **Graceful Fallback**: Falls back to rule-based detection if AI fails
- **React Hooks**: Easy integration with React components
- **Enhanced Chat Integration**: Seamless integration with existing chat API

## Intent Types

### 1. REFUND_REQUEST
Detects when users want to request refunds with details like:
- Order information
- Reason for refund (damage, non_delivery, wrong_item, other)
- Evidence (photos)
- Refund amount

### 2. PRODUCT_RECOMMENDATION  
Detects product recommendation requests with:
- Budget constraints
- Category preferences
- Occasion context
- Recipient (self/gift)
- Product attributes/features

### 3. POLICY_QA
Detects policy-related questions about:
- Returns
- Shipping
- Payments
- Account management

## Usage

### Basic AI Intent Detection

```typescript
import { detectBuyerIntentWithAI } from '@/lib/chatbot/buyer-intent/ai-detection';

const result = await detectBuyerIntentWithAI(
  "I need a refund for my damaged phone",
  { history: chatHistory }
);

if (result.success) {
  console.log('Detected intent:', result.intent.intent);
  console.log('Payload:', result.intent.payload);
}
```

### React Hook Integration

```typescript
import { useBuyerIntentDetection } from '@/lib/hooks/use-buyer-intent-detection';

function MyChatComponent() {
  const { intent, loading, detectIntent } = useBuyerIntentDetection();

  const handleMessage = async (message: string) => {
    const detectedIntent = await detectIntent(message, { history });
    console.log('Detected:', detectedIntent);
  };

  return <ChatInput onSend={handleMessage} />;
}
```

### Enhanced Chat with AI Detection

```typescript
import { useChatWithIntentDetection } from '@/lib/hooks/use-buyer-intent-detection';

function EnhancedChatComponent() {
  const { 
    sendMessageWithIntent, 
    chatResponse, 
    chatLoading,
    intent 
  } = useChatWithIntentDetection();

  const handleSendMessage = async (message: string) => {
    await sendMessageWithIntent(message, {
      category: 'phone',
      history: conversationHistory
    });
  };

  return (
    <div>
      <div>Detected Intent: {intent?.intent}</div>
      <ChatInput onSend={handleSendMessage} loading={chatLoading} />
      <ChatResponse response={chatResponse} />
    </div>
  );
}
```

### Class-Based Integration

```typescript
import { EnhancedBuyerChat } from '@/lib/chatbot/buyer-intent/chat-integration';

const chat = new EnhancedBuyerChat({
  category: 'phone',
  price_max: 20000
});

// Send message with AI detection
const result = await chat.sendMessage(
  "Recommend me a phone under 20000 BDT"
);

if (result.success) {
  console.log('Response:', result.data.reply);
  console.log('Used AI detection:', result.usedAIDetection);
}
```

## API Reference

### detectBuyerIntentWithAI(message, context)

Detects buyer intent using AI.

- **message**: User message string
- **context**: Optional chat context with history
- **Returns**: Promise with success status and intent or error

### useBuyerIntentDetection()

React hook for intent detection.

- **Returns**: Object with intent state, loading status, and detectIntent function

### useChatWithIntentDetection()

React hook that combines intent detection with chat API calls.

- **Returns**: Object with intent/chat states and sendMessageWithIntent function

### EnhancedBuyerChat

Class-based API for managing chat sessions with AI detection.

- **constructor(initialContext)**: Initialize with optional context
- **sendMessage(message, options)**: Send message with AI detection
- **updateContext(updates)**: Update chat context
- **getContext()**: Get current context
- **resetHistory()**: Clear conversation history

## Fallback Behavior

If AI detection fails or is not configured, the system automatically falls back to rule-based detection:

- **Refund keywords** → REFUND_REQUEST intent
- **Policy keywords** → POLICY_QA intent  
- **Default** → PRODUCT_RECOMMENDATION intent

## Configuration

AI detection requires proper AI configuration:

```typescript
import { isAIConfigured } from '@/lib/services/ai/config';

if (isAIConfigured()) {
  // AI detection will work
} else {
  // Falls back to rule-based detection
}
```

## Benefits

1. **More Accurate**: AI understands context better than regex patterns
2. **Structured Data**: Returns detailed, typed intent payloads
3. **Tool Integration**: Enables advanced tool calling in the chat API
4. **Resilient**: Graceful fallback ensures reliability
5. **Easy Integration**: Drop-in replacement for existing chat logic

## Example Output

```json
{
  "intent": "PRODUCT_RECOMMENDATION",
  "payload": {
    "budget": {
      "max": 20000,
      "currency": "BDT"
    },
    "category": "phone",
    "recipient": "gift",
    "occasion": "birthday",
    "attributes": ["gaming", "camera"]
  },
  "metadata": {
    "confidenceScore": 0.95,
    "isPartial": false,
    "source": "ai_detection"
  }
}
```

This enables the chat API to provide more sophisticated responses and enable advanced features like automated tool calling.
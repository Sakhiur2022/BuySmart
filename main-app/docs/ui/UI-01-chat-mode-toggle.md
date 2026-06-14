# UI-01 — Chat Mode Toggle: Agentic vs Manual Fallback

## Overview

The chat mode toggle allows buyers to switch between two operational modes for the BuySmart chatbot:

- **Agentic mode (default):** The chatbot uses the AI pipeline (CHAT-01 intent classification, API-01 tool services, LangChain/Groq agent) to handle buyer messages automatically with intelligent responses.
- **Manual fallback mode:** The chatbot bypasses the AI pipeline and returns an immediate human support prompt, flagged for escalation.

**User experience:**

- Toggle button in the chatbot widget header (top-right, near fullscreen button)
- Visual indicators: color-coded (emerald for agentic, amber for manual) with icon and badge label
- Toast notification confirming mode change (2 seconds, auto-dismiss)
- Manual fallback mode disables message input and shows a support prompt banner
- Mode state persists for the duration of the chat session
- Mode resets to agentic on sign-in/sign-out

---

## Architecture

### 1. Strategy Pattern

Two concrete strategies encapsulate mode-specific behavior:

#### AgenticChatStrategy

**File:** `lib/chatbot/strategies/agentic-chat-strategy.ts`

**Responsibilities:**

- Send message to `/api/buyer/chat` endpoint
- Receive `ChatAPIResponse` with intent, toolCall, reply, products, order, etc.
- Build assistant message from response
- Handle tool results, escalations, refund cards, policy text
- Return `ChatSendResult` with user message, assistant message, and response

**Behavior:** Delegates to existing AI pipeline; no modifications to API routes or intent validation.

#### ManualFallbackStrategy

**File:** `lib/chatbot/strategies/manual-fallback-strategy.ts`

**Responsibilities:**

- Do NOT call API endpoint
- Create user message in local state
- Return pre-composed fallback response with `isEscalation: true`
- Build assistant message with fallback reply
- Return `ChatSendResult` immediately without network delay

**Behavior:** Local-only operation; no side effects beyond state updates.

### 2. Strategy Interface

**File:** `lib/chatbot/strategies/types.ts`

```typescript
export interface ChatStrategy {
  handle(
    message: string,
    context: ChatContext,
    options?: ChatMessageSendOptions,
  ): Promise<ChatSendResult>;
}
```

**Design principle:** Strategy-agnostic caller (widget's handleSend) delegates to active strategy. Switching modes = selecting strategy.

### 3. ChatModeHandler (Decorator)

**File:** `lib/chatbot/chat-mode-handler.ts`

**Responsibility:** Instantiate and manage both strategies; return active strategy based on mode.

```typescript
const handler = new ChatModeHandler('/api/buyer/chat', 'buyer');
const strategy = handler.getStrategy('agentic'); // AgenticChatStrategy
const strategy = handler.getStrategy('manual-fallback'); // ManualFallbackStrategy
```

**Extensibility:** To add a new mode (e.g., "supervised"), create a new strategy class and register it in the handler.

### 4. useChatMode Hook

**File:** `lib/hooks/use-chat-mode.ts`

**Responsibility:** Manage mode state, persist to sessionStorage, emit ModeChanged events, expose toggle and reset functions.

**Return type:**

```typescript
{
  currentMode: 'agentic' | 'manual-fallback';
  isAgentic: boolean;
  toggle: (newMode?: ChatMode) => void;
  reset: () => void;
  emitter: ChatModeEventEmitter;
}
```

**Session persistence:** Reads/writes mode to `sessionStorage` via `buysmart.chat-widget-mode.{role}` key.

### 5. ChatModeEventEmitter

**File:** `lib/chatbot/chat-mode-events.ts`

**Events emitted:**

- `mode_changed`: { newMode, previousMode, timestamp, role }

**API:**

- `on('mode_changed', callback) → () => void` (unsubscribe function)
- `emit('mode_changed', event)`
- `getChatModeEventEmitter(role)` (singleton per role)

**Purpose:** Allows mascot hook, analytics, logging, and future extensions to react to mode changes without coupling to the toggle button.

---

## Component Location

### Widget hierarchy:

1. **BuyerChatbotWidget** (`components/shared/buyer-chatbot-widget.tsx`)
   - Conditional wrapper; only renders on non-admin/seller routes

2. **ChatbotWidget** (`components/shared/chatbot-widget.tsx`)
   - Main chatbot component; renders for all roles (buyer, seller, admin)
   - Imports and uses `useChatMode` hook
   - Passes `chatMode.toggle()` to toggle button
   - Passes `chatMode.isAgentic` to conditional rendering

### Toggle button:

- Location: Widget header, top-right (alongside fullscreen button)
- Icon: Zap (lucide-react)
- Colors: Emerald (agentic) / Amber (manual)
- Badge: "Agentic" / "Manual" label with colored dot
- Aria-label and title for accessibility

### Manual fallback overlay:

- Banner above message input: "Manual support mode active"
- Message input disabled when `!chatMode.isAgentic`
- Send button disabled when `!chatMode.isAgentic`
- Styles: Amber warning colors; concise help text

---

## Hook API

### useChatMode(role: ChatbotRole)

```typescript
const chatMode = useChatMode('buyer');

// State
chatMode.currentMode; // 'agentic' | 'manual-fallback'
chatMode.isAgentic; // boolean convenience flag

// Control
chatMode.toggle(); // toggle between modes, emit event, persist to storage
chatMode.toggle('agentic'); // set to specific mode
chatMode.reset(); // reset to 'agentic', emit event, persist

// Events
chatMode.emitter.on('mode_changed', (event) => {
  console.log(`Mode changed from ${event.previousMode} to ${event.newMode}`);
});
```

### Hydration & persistence:

- On mount: Reads persisted mode from sessionStorage; defaults to 'agentic' if missing/invalid
- On change: Writes mode to sessionStorage immediately via `useEffect`
- On auth change: `resetChatSession()` calls `chatMode.reset()` to reset mode to 'agentic'

---

## Strategy Extensibility

### To add a new mode (e.g., "supervised"):

1. **Create strategy class:**

   ```typescript
   // lib/chatbot/strategies/supervised-chat-strategy.ts
   export class SupervisedChatStrategy implements ChatStrategy {
     async handle(message, context, options) {
       // Send to AI, hold response in queue for human review, return acknowledgment
     }
   }
   ```

2. **Register in ChatModeHandler:**

   ```typescript
   // In chat-mode-handler.ts constructor or factory method
   this.supervisedStrategy = new SupervisedChatStrategy(apiEndpoint, role);

   getStrategy(mode: ChatMode) {
     if (mode === 'supervised') return this.supervisedStrategy;
     // ... existing branches
   }
   ```

3. **Update mode type:**

   ```typescript
   // In chat-mode-events.ts
   export type ChatMode = 'agentic' | 'manual-fallback' | 'supervised';
   ```

4. **Update toggle UI (optional):**
   - Add third visual state (icon color, badge label)
   - Document new mode in toggle button aria-label

**No changes needed to:** API routes, intent validation, widget core logic, message sending.

---

## Session Persistence Approach

### Storage mechanism:

- **Key:** `buysmart.chat-widget-mode.{role}` (e.g., `buysmart.chat-widget-mode.buyer`)
- **Value:** `'agentic'` | `'manual-fallback'` (plain string)
- **Scope:** `sessionStorage` (clears on browser tab close)
- **Pattern:** Consistent with existing keys for open, messages, context, authMarker

### Hydration:

1. On component mount, `useChatMode` reads from sessionStorage
2. If value is valid, restore it; else default to 'agentic'
3. On every mode change, write to sessionStorage
4. Survives page reload/navigation within same session

### Reset triggers:

- Auth state change (sign-in/sign-out) → reset to 'agentic'
- Explicit user action via toggle → write new mode to storage

### Storage failure:

- Hook catches errors and continues (graceful degradation)
- Default to 'agentic' if storage is unavailable
- Widget remains fully functional

---

## Accessibility

### Keyboard navigation:

- Toggle button is keyboard-accessible (tab stops)
- Toggle button has visible focus ring (ring-2 focus-visible:ring-rose-200)
- ARIA labels on toggle button:
  - "Agentic mode active. Click to enable manual fallback mode."
  - "Manual fallback mode active. Click to enable agentic mode."

### Screen reader support:

- Badge label ("Agentic" / "Manual") is visible text; read by screen readers
- Mode status line ("BuySmart assistant" vs "Manual mode") provides context
- Banner in manual mode: "Manual support mode active" + explanatory text

### Visual indicators:

- Color alone is not the only indicator (color + icon + badge + text)
- High contrast: emerald/amber on light backgrounds

### Input field state:

- When disabled: `aria-disabled` applied; visual opacity change; tooltip via title
- Placeholder text clear and helpful

---

## Testing

### Unit tests — `tests/unit/hooks/use-chat-mode.test.ts`

1. Hook initializes with default mode 'agentic'
2. Hook reads valid persisted mode from sessionStorage on mount
3. Hook writes mode to sessionStorage on every toggle
4. Toggle function switches mode; emits ModeChanged event
5. Reset function returns mode to 'agentic'; emits ModeChanged event
6. Hook cleans up event listeners on unmount
7. If sessionStorage fails, hook still functions and defaults to 'agentic'

### Unit tests — `tests/unit/chatbot/chat-mode-events.test.ts`

1. getChatModeEventEmitter returns singleton for a given role
2. on() registers callback and returns unsubscribe function
3. emit() calls all registered callbacks with correct event object
4. unsubscribe() removes listener
5. Multiple listeners can be registered for same event

### Unit tests — `tests/unit/chatbot/strategies/agentic-chat-strategy.test.ts`

1. AgenticChatStrategy.handle() calls API endpoint with correct payload
2. On success: returns ChatSendResult with user message, assistant message, response
3. On network error: throws error (caller handles retry)
4. Handles response fields: products, order, refund cards, policy text, isEscalation

### Unit tests — `tests/unit/chatbot/strategies/manual-fallback-strategy.test.ts`

1. ManualFallbackStrategy.handle() does NOT call API
2. Returns ChatSendResult immediately with fallback response
3. isEscalation flag is set to true

### Integration tests — Update `tests/integration/buyer-chatbot-widget.test.tsx`

1. Mode toggle button renders in widget header with correct icon and label
2. Clicking toggle switches badge label from "Agentic" to "Manual" and vice versa
3. Toast notification appears on toggle, auto-dismisses in 2 seconds
4. In agentic mode: message send calls API endpoint
5. In manual mode: message send returns fallback response without API call
6. In manual mode: input field is disabled; send button is disabled
7. In manual mode: banner shows "Manual support mode active"
8. Mode state persists in sessionStorage
9. On auth change (sign-in/sign-out), mode resets to 'agentic'
10. Buyer, seller, admin modes have independent state (separate storage keys)

---

## Known Limitations & Future Work

### Current limitations:

1. **No real-time AI failure detection:** Manual mode is user-initiated only. In future, could auto-switch if AI pipeline fails N times in a row.
2. **Manual mode does not queue for human review:** It returns immediate fallback. Could extend with queue + review UI (SupervisedChatStrategy).
3. **Mascot does not respond to mode changes:** Could extend useMascotTrigger to subscribe to ModeChanged events and show fallback expression in manual mode.
4. **Analytics:** Mode changes are not currently tracked. Could subscribe to ModeChanged events in analytics module.

### Future extensions:

- Supervised mode: AI response held pending human review before display
- Analytics integration: Track mode change frequency, duration, user segments
- Mascot integration: Mascot shows different expression/state in manual mode
- Auto-fallback: Automatic switch to manual mode after N consecutive AI failures
- A/B testing: Compare user satisfaction, CSAT, resolution rate between modes

---

## Implementation Notes

- **No modifications to API routes** (`app/api/buyer/chat/route.ts`, `app/api/chat/route.ts`)
- **No modifications to intent validation** (`lib/chatbot/buyer-intent/`)
- **No modifications to tool invocation** (`lib/chatbot/buyer-intent/tool-invocation.ts`)
- **Backward compatible:** Existing single-mode behavior preserved when not toggled
- **Graceful degradation:** If sessionStorage unavailable, mode defaults to 'agentic'
- **Performance:** No extra API calls; toggle is instant; strategy instantiation is lazy (on first use)

---

## Change Summary

### Files created:

- `lib/chatbot/chat-mode-events.ts` — Event emitter and event types
- `lib/hooks/use-chat-mode.ts` — Hook for mode state management
- `lib/chatbot/strategies/types.ts` — Strategy interface and result type
- `lib/chatbot/strategies/agentic-chat-strategy.ts` — AI pipeline strategy
- `lib/chatbot/strategies/manual-fallback-strategy.ts` — Fallback strategy
- `lib/chatbot/chat-mode-handler.ts` — Strategy manager/decorator
- `docs/ui/UI-01-chat-mode-toggle.md` — This document

### Files modified:

- `lib/chatbot/session.ts` — Added storage key constant and updated key getter, clear function
- `components/shared/chatbot-widget.tsx` — Replaced inline state with useChatMode hook, updated toggle handler, added toast, added manual fallback banner, disabled input in manual mode

---

## Questions?

Refer to the open questions section in the implementation plan document for design decisions and rationale.

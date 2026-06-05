const REFUND_MESSAGE_PATTERN = /\b(refund|return|refund policy|refund status|request refund|wrong item|defective|damaged|exchange)\b/i;
const ORDER_ID_PATTERN = /\bORD[-_]?(\d+)\b/i;

function extractOrderId(message: string) {
  const match = message.match(ORDER_ID_PATTERN);
  return match ? match[0].toUpperCase().replace('_', '-') : null;
}

export function isRefundRelatedMessage(message: string) {
  return REFUND_MESSAGE_PATTERN.test(message);
}

export function buildRefundFallbackReply(message: string) {
  const normalized = message.toLowerCase();
  const orderId = extractOrderId(message);

  if (/\b(status|progress|update|track|check)\b/.test(normalized)) {
    return 'Open Refund status and tap Details for the latest update.';
  }

  if (/\b(request|apply|start|submit|make|get)\b/.test(normalized)) {
    if (orderId) {
      return `Tap Orders, open View details for order ${orderId}, then use Request Refund.`;
    }

    return 'Tap Orders, open View details for the order, then use Request Refund.';
  }

  if (orderId) {
    return `Tap Orders, open View details for order ${orderId}, then use Request Refund.`;
  }

  return 'I can help with Refund status or Request Refund from Orders.';
}

export function buildRefundTimeoutReply(message: string, timeoutSeconds: number) {
  return `The chat request timed out after ${timeoutSeconds} seconds. ${buildRefundFallbackReply(message)}`;
}
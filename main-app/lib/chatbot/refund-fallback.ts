const REFUND_MESSAGE_PATTERN = /\b(refund|return|refund policy|refund status|request refund|wrong item|defective|damaged|exchange)\b/i;
const ORDER_ID_PATTERN = /\bORD[-_]?(\d+)\b/i;
export const REFUND_MANUAL_REQUEST_ROUTE = '/buyer/orders';
export const REFUND_MANUAL_REQUEST_GUIDED_ROUTE = '/buyer/orders?guide=refund';

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
    return 'Open Orders and check Refund status for the latest update.';
  }

  if (/\b(request|apply|start|submit|make|get)\b/.test(normalized)) {
    if (orderId) {
      return `Open Orders, open View details for order ${orderId}, then tap Request Refund.`;
    }

    return 'Open Orders, open View details for the order, then tap Request Refund.';
  }

  if (orderId) {
    return `Open Orders, open View details for order ${orderId}, then tap Request Refund.`;
  }

  return 'Open Orders to check Refund status or submit a Request Refund manually.';
}

export function buildRefundTimeoutReply(message: string, timeoutSeconds: number) {
  return `The chat request timed out after ${timeoutSeconds} seconds. ${buildRefundFallbackReply(message)}`;
}

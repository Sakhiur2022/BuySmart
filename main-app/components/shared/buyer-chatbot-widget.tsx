"use client";

import { usePathname } from 'next/navigation';
import ChatbotWidget from '@/components/shared/chatbot-widget';

export default function BuyerChatbotWidget() {
  const pathname = usePathname();
  const isAdminOrSeller = pathname.startsWith('/admin') || pathname.startsWith('/seller');

  if (isAdminOrSeller) {
    return null;
  }

  return <ChatbotWidget chatbotRole="buyer" />;
}

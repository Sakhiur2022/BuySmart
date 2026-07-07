import { NextRequest } from 'next/server';
import { handleRoleChatRequest } from '@/lib/chatbot/role-chat-api';
import { SellerChatToolsFacade } from '@/lib/chatbot/seller-intent/facade';

const sellerFacade = new SellerChatToolsFacade();

export async function POST(request: NextRequest) {
  return handleRoleChatRequest(request, 'seller', sellerFacade);
}

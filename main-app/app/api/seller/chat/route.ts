import { NextRequest } from 'next/server';
import { handleRoleChatRequest } from '@/lib/chatbot/role-chat-api';

export async function POST(request: NextRequest) {
  // Passing only request and role; optional facade can be injected later.
  return handleRoleChatRequest(request, 'seller');
}

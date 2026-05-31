import { NextRequest } from 'next/server';
import { handleRoleChatRequest } from '@/lib/chatbot/role-chat-api';

export async function POST(request: NextRequest) {
  return handleRoleChatRequest(request, 'seller');
}

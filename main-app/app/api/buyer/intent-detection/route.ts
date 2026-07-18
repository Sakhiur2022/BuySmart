import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { detectBuyerIntentWithAI, createFallbackBuyerIntent } from '@/lib/chatbot/buyer-intent/ai-detection';

const requestSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().trim().min(1).max(2000),
      }),
    )
    .optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsedBody = requestSchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json(
        {
          error: 'Invalid request payload',
          issues: parsedBody.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { message, history } = parsedBody.data;

    // Perform AI intent detection on the server side
    const detectionResult = await detectBuyerIntentWithAI(message, { history });

    if (detectionResult.success) {
      return NextResponse.json({
        success: true,
        intent: detectionResult.intent,
        usedAI: true,
      });
    } else {
      // Use fallback if AI detection fails
      const fallbackIntent = createFallbackBuyerIntent(message);
      return NextResponse.json({
        success: true,
        intent: fallbackIntent,
        usedAI: false,
        fallbackReason: detectionResult.error,
      });
    }
  } catch (error) {
    console.error('Intent detection error:', error);
    
    // Always return a fallback intent to ensure the chat continues working
    const body = await request.json().catch(() => ({ message: '' }));
    const fallbackIntent = createFallbackBuyerIntent(body.message || '');
    
    return NextResponse.json({
      success: true,
      intent: fallbackIntent,
      usedAI: false,
      fallbackReason: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
/**
 * src/app/api/chat/route.ts — Chat endpoint
 *
 * POST /api/chat
 * Request: { sessionId, message, language }
 * Response: { response, state, status, eligibilityResult?, nextField? }
 */

import type { NextRequest } from 'next/server';
import { processMessage } from '@/src/server/conversation/service';

interface ChatRequest {
  sessionId: string;
  message: string;
  language?: string;
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body: ChatRequest = await request.json();
    const { sessionId, message, language = 'ta' } = body;

    if (!sessionId || !message) {
      return Response.json(
        { error: 'Missing sessionId or message' },
        { status: 400 }
      );
    }

    // Process the message
    const result = await processMessage(sessionId, message, language as any);

    return Response.json(result, { status: 200 });
  } catch (error) {
    console.error('Chat API error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

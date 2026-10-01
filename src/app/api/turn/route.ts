import { NextRequest, NextResponse } from 'next/server';
import { getEnv } from '@/src/server/env/config';
import { getEnabledLanguages } from '@/config/languages';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  const env = getEnv();

  try {
    const body = await request.json();
    const { sessionId, input, stateSnapshot } = body;

    // Basic validation
    if (!sessionId) {
      return NextResponse.json(
        { ok: false, error: { code: 'INVALID_INPUT', message: ' sessionId required', retryable: false } },
        { status: 400 }
      );
    }

    if (!input || !input.text) {
      return NextResponse.json(
        { ok: false, error: { code: 'INVALID_INPUT', message: 'Input text is required', retryable: false } },
        { status: 400 }
      );
    }

    // For Phase 1, return a simple response
    // In a full implementation, this would process the user's input
    // through the conversation state machine, eligibility engine, etc.

    // Get enabled languages to determine current language context
    const enabledLanguages = getEnabledLanguages(env.ENABLED_LANGUAGES);
    
    // Create a basic response
    const responseText = `You said: ${input.text}. This is a Phase 1 prototype response.`;

    // Build a simplified state (in production, this would persist and update properly)
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + env.SESSION_TTL_HOURS * 60 * 60 * 1000).toISOString();

    const updatedState = {
      version: 1,
      sessionId,
      language: enabledLanguages[0]?.code || 'ta',
      schemeId: env.ACTIVE_SCHEME_ID,
      schemeVersion: 1,
      currentStep: 'intent_discovery',
      facts: {},
      factMeta: {},
      askedCount: {},
      unanswerableFields: [],
      missingFields: [],
      pendingQuestion: null,
      lastEligibility: null,
      lastReply: {
        text: responseText,
        planAction: 'clarify_unclear',
      },
      voice: {
        asr: 'text',
        tts: 'text',
        consecutiveAsrFailures: 0,
        consecutiveTtsFailures: 0,
      },
      counters: {
        turns: 1,
        consecutiveUnclear: 0,
        consecutiveLanguageMismatch: 0,
      },
      createdAt: now,
      lastUpdated: now,
      expiresAt,
    };

    const reply = {
      text: responseText,
      language: updatedState.language,
      quickReplies: [
        { id: 'yes', icon: 'check', label: 'Yes' },
        { id: 'no', icon: 'cross', label: 'No' },
        { id: 'repeat', icon: 'repeat', label: 'Repeat' },
      ],
    };

    return NextResponse.json({
      ok: true,
      data: {
        state: updatedState,
        reply,
        cards: [],
        degraded: {},
      },
    });
  } catch (error) {
    console.error('Turn processing error:', error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL', message: 'Internal server error', retryable: false } },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { getEnv } from '@/src/server/env/config';
import { getEnabledLanguages } from '@/config/languages';
import { v4 as uuidv4 } from 'uuid';
import type { CreateSessionRequest, CreateSessionResponse } from '@/src/types/api';

export async function POST(request: Request) {
  const env = getEnv();
  
  try {
    const body: CreateSessionRequest = await request.json();
    const { language } = body;

    // Validate language
    const enabledLanguages = getEnabledLanguages(env.ENABLED_LANGUAGES);
    if (!enabledLanguages.some((l) => l.code === language)) {
      return NextResponse.json(
        { ok: false, error: { code: 'UNSUPPORTED_LANGUAGE', message: 'Language not supported', retryable: false } },
        { status: 400 }
      );
    }

    // Create session
    const sessionId = uuidv4();
    const now = new Date().toISOString();
    const ttlHours = env.SESSION_TTL_HOURS;
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();

    // Get welcome text for this language
    const langConfig = enabledLanguages.find((l) => l.code === language);
    const welcomeText = langConfig?.welcomeText || 'Hello. How can I help you today?';

    // Initialize conversation state
    const initialState: CreateSessionResponse['state'] = {
      version: 1,
      sessionId,
      language,
      schemeId: null,
      schemeVersion: null,
      currentStep: 'intent_discovery',
      facts: {},
      factMeta: {},
      askedCount: {},
      unanswerableFields: [],
      missingFields: [],
      pendingQuestion: null,
      lastEligibility: null,
      lastReply: null,
      voice: {
        asr: 'text',
        tts: 'text',
        consecutiveAsrFailures: 0,
        consecutiveTtsFailures: 0,
      },
      counters: {
        turns: 0,
        consecutiveUnclear: 0,
        consecutiveLanguageMismatch: 0,
      },
      createdAt: now,
      lastUpdated: now,
      expiresAt,
    };

    const replyText = welcomeText;

    const response: CreateSessionResponse = {
      state: initialState,
      reply: {
        text: replyText,
        language,
        quickReplies: [],
      },
    };

    return NextResponse.json({ ok: true, data: response });
  } catch (error) {
    console.error('Session creation error:', error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL', message: 'Internal server error', retryable: false } },
      { status: 500 }
    );
  }
}

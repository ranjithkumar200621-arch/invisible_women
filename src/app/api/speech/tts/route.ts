/**
 * src/app/api/speech/tts/route.ts — Text-to-Speech endpoint
 *
 * Receives text from client, calls Sarvam, returns audio base64.
 * SarvAM_API_KEY is kept server-side - never exposed to browser.
 */

import { NextRequest, NextResponse } from 'next/server';
import { textToSpeech } from '@/src/server/speech/sarvam';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { text, languageCode, speaker } = body;

    if (!text) {
      return NextResponse.json(
        { error: 'text is required' },
        { status: 400 }
      );
    }

    if (!languageCode) {
      return NextResponse.json(
        { error: 'languageCode is required' },
        { status: 400 }
      );
    }

    // Call Sarvam TTS
    const result = await textToSpeech({
      text,
      languageCode,
      speaker,
    });

    return NextResponse.json({
      success: true,
      audioBase64: result.audioBase64,
      mimeType: result.mimeType,
    });
  } catch (error: any) {
    console.error('TTS API error:', error);

    if (error.message.includes('SARVAM_API_KEY') || error.message.includes('environment variable')) {
      return NextResponse.json(
        { error: 'SARVAM_API_KEY not configured', fallbackRequired: true },
        { status: 501 }
      );
    }

    return NextResponse.json(
      { error: 'Text-to-speech failed', message: error.message, fallbackRequired: true },
      { status: 500 }
    );
  }
}

/**
 * src/app/api/speech/asr/route.ts — Speech-to-Text endpoint
 *
 * Receives audio base64 from client, calls Sarvam, returns transcript.
 * SarvAM_API_KEY is kept server-side - never exposed to browser.
 */

import { NextRequest, NextResponse } from 'next/server';
import { speechToText } from '@/src/server/speech/sarvam';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { audioBase64, languageCode } = body;

    if (!audioBase64) {
      return NextResponse.json(
        { error: 'audioBase64 is required' },
        { status: 400 }
      );
    }

    if (!languageCode) {
      return NextResponse.json(
        { error: 'languageCode is required' },
        { status: 400 }
      );
    }

    // Call Sarvam ASR
    const result = await speechToText({
      audioBase64,
      languageCode,
    });

    return NextResponse.json({
      success: true,
      transcript: result.transcript,
      confidence: result.confidence,
    });
  } catch (error: any) {
    console.error('ASR API error:', error);
    
    if (error.message.includes('SARVAM_API_KEY') || error.message.includes('environment variable')) {
      return NextResponse.json(
        { error: 'SARVAM_API_KEY not configured', fallbackRequired: true },
        { status: 501 }
      );
    }

    return NextResponse.json(
      { error: 'Speech-to-text failed', message: error.message, fallbackRequired: true },
      { status: 500 }
    );
  }
}

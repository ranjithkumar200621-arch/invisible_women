/**
 * src/server/speech/sarvam.ts — Sarvam voice integration
 *
 * Uses Sarvam for:
 * - Speech-to-text (ASR): audio → transcript
 * - Text-to-speech (TTS): text → audio
 *
 * Sarvam API docs: https://docs.sarvam.ai/
 */

const SARVAM_API_KEY = process.env.SARVAM_API_KEY || '';

// Sarvam API endpoints
const ASR_ENDPOINT = 'https://api.sarvam.ai/v1/speech-to-text';
const TTS_ENDPOINT = 'https://api.sarvam.ai/v1/text-to-speech';

export interface SarvamASROptions {
  audioBase64: string;
  languageCode: string; // e.g., 'ta', 'hi', 'te'
}

export interface SarvamASROutput {
  transcript: string;
  confidence?: number;
}

export interface SarvamTTSPayload {
  text: string;
  languageCode: string; // e.g., 'ta-IN', 'hi-IN', 'te-IN'
  speaker?: string; // voice name
  pitch?: number;
  rate?: number;
}

export interface SarvamTTSOutput {
  audioBase64: string;
  mimeType: string; // typically 'audio/mp3' or 'audio/wav'
}

/**
 * Speech-to-text: Convert audio to transcript
 */
export async function speechToText(options: SarvamASROptions): Promise<SarvamASROutput> {
  if (!SARVAM_API_KEY) {
    throw new Error('SARVAM_API_KEY environment variable is required');
  }

  // Map language codes to Sarvam format
  const sarvamLanguageMap: Record<string, string> = {
    'ta': 'ta-IN',
    'hi': 'hi-IN',
    'te': 'te-IN',
    'en': 'en-IN',
    'kn': 'kn-IN',
    'ml': 'ml-IN',
    'bn': 'bn-IN',
    'mr': 'mr-IN',
    'gu': 'gu-IN',
    'pa': 'pa-IN',
    'or': 'or-IN',
  };

  const sarvamLanguage = sarvamLanguageMap[options.languageCode] || 'ta-IN';

  try {
    const response = await fetch(ASR_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SARVAM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio_base64: options.audioBase64,
        model: 'paaraa-1.0',
        language_code: sarvamLanguage,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Sarvam ASR error:', errorText);
      throw new Error(`Sarvam ASR failed: ${response.status}`);
    }

    const data = await response.json();
    
    // Parse response - adjust based on actual Sarvam API response format
    const transcript = data.transcript || data.text || '';
    
    return {
      transcript,
      confidence: data.confidence || 0.9,
    };
  } catch (error) {
    console.error('Sarvam ASR error:', error);
    throw error;
  }
}

/**
 * Text-to-speech: Convert text to audio
 */
export async function textToSpeech(payload: SarvamTTSPayload): Promise<SarvamTTSOutput> {
  if (!SARVAM_API_KEY) {
    throw new Error('SARVAM_API_KEY environment variable is required');
  }

  // Map language codes to Sarvam format
  const sarvamLanguageMap: Record<string, string> = {
    'ta': 'ta-IN',
    'hi': 'hi-IN',
    'te': 'te-IN',
    'en': 'en-IN',
    'kn': 'kn-IN',
    'ml': 'ml-IN',
    'bn': 'bn-IN',
    'mr': 'mr-IN',
    'gu': 'gu-IN',
    'pa': 'pa-IN',
    'or': 'or-IN',
  };

  const sarvamLanguage = sarvamLanguageMap[payload.languageCode] || 'ta-IN';

  // Map language to speaker
  const speakerMap: Record<string, string> = {
    'ta': 'priya',
    'hi': 'neha',
    'te': 'lalitha',
    'en': 'sarah',
    'kn': 'ashwini',
    'ml': 'ananya',
    'bn': 'payal',
    'mr': 'kavita',
    'gu': 'maithili',
    'pa': 'harman',
    'or': 'smriti',
  };

  const speaker = payload.speaker || speakerMap[payload.languageCode] || 'priya';

  try {
    const response = await fetch(TTS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SARVAM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: payload.text,
        model: 'saarva-1.0',
        language_code: sarvamLanguage,
        speaker,
        pitch: payload.pitch ?? 1,
        rate: payload.rate ?? 1,
        output_format: 'mp3',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Sarvam TTS error:', errorText);
      throw new Error(`Sarvam TTS failed: ${response.status}`);
    }

    const data = await response.json();
    
    // Parse response - adjust based on actual Sarvam API response format
    const audioBase64 = data.audio_base64 || data.audio || '';
    
    return {
      audioBase64,
      mimeType: 'audio/mp3',
    };
  } catch (error) {
    console.error('Sarvam TTS error:', error);
    throw error;
  }
}

/**
 * Get supported languages for Sarvam
 */
export function getSupportedLanguages(): string[] {
  return Object.keys(sarvamLanguageMap);
}

// Export the language map for use
export const sarvamLanguageMap: Record<string, string> = {
  'ta': 'ta-IN',
  'hi': 'hi-IN',
  'te': 'te-IN',
  'en': 'en-IN',
  'kn': 'kn-IN',
  'ml': 'ml-IN',
  'bn': 'bn-IN',
  'mr': 'mr-IN',
  'gu': 'gu-IN',
  'pa': 'pa-IN',
  'or': 'or-IN',
};

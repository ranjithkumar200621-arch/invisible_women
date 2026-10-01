/**
 * src/server/speech/sarvam.ts — Sarvam voice integration
 *
 * Uses Sarvam for:
 * - Speech-to-text (ASR): audio → transcript
 * - Text-to-speech (TTS): text → audio
 *
 * API References:
 * - ASR: https://docs.sarvam.ai/api-reference/speech-to-text/transcribe
 * - TTS: https://docs.sarvam.ai/api-reference/text-to-speech/convert
 */

const SARVAM_API_KEY = process.env.SARVAM_API_KEY || '';

// Sarvam API endpoints (CORRECT endpoints from official docs)
const ASR_ENDPOINT = 'https://api.sarvam.ai/speech-to-text';
const TTS_ENDPOINT = 'https://api.sarvam.ai/text-to-speech';

// Sarvam models
const ASR_MODEL = 'saaras:v4';
const TTS_MODEL = 'bulbul:v3';

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
  pace?: number;
}

export interface SarvamTTSOutput {
  audioBase64: string;
  mimeType: string; // typically 'audio/mp3' or 'audio/wav'
}

/**
 * Speech-to-text: Convert audio to transcript
 * Uses multipart/form-data with file upload (Sarvam API requirement)
 */
export async function speechToText(options: SarvamASROptions): Promise<SarvamASROutput> {
  if (!SARVAM_API_KEY) {
    throw new Error('SARVAM_API_KEY environment variable is required');
  }

  // Map language codes to Sarvam BCP-47 format
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

  // Convert base64 to blob for multipart upload
  const binaryString = atob(options.audioBase64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const audioBlob = new Blob([bytes], { type: 'audio/webm' });

  // Create multipart form data
  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.webm');
  formData.append('model', ASR_MODEL);
  formData.append('language_code', sarvamLanguage);

  try {
    const response = await fetch(ASR_ENDPOINT, {
      method: 'POST',
      headers: {
        'api-subscription-key': SARVAM_API_KEY, // Correct header for Sarvam
      },
      body: formData,
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

  // Map language codes to Sarvam BCP-47 format
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

  // Map language to speaker (for bulbul:v3)
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

  const speaker = payload.speaker || speakerMap[payload.languageCode] || 'shubh';

  try {
    const response = await fetch(TTS_ENDPOINT, {
      method: 'POST',
      headers: {
        'api-subscription-key': SARVAM_API_KEY, // Correct header for Sarvam
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: payload.text,
        model: TTS_MODEL,
        language_code: sarvamLanguage,
        speaker,
        pace: payload.pace ?? 1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Sarvam TTS error:', errorText);
      throw new Error(`Sarvam TTS failed: ${response.status}`);
    }

    const data = await response.json();
    
    // Parse response - adjust based on actual Sarvam API response format
    const audioBase64 = data.audios?.[0] || data.audio_base64 || data.audio || '';

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

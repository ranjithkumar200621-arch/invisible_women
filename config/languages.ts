/**
 * config/languages.ts — the ONLY place language-specific data lives.
 *
 * Before enabling a language (enabled: true) you must have:
 *   1. Verified ASR/TTS availability for it against the live Bhashini pipeline
 *      config, then set asr/tts to 'available' | 'unavailable'.
 *   2. A reviewed welcomeText (below).
 *   3. A complete entry in data/fallback-phrases.json (see ARCHITECTURE.md §17).
 *
 * welcomeText strings below are DRAFTS written without native-speaker review.
 * Have a native speaker check them before any demo.
 */
import type { LanguageCode, LanguageConfig, SpeechKind } from '../src/types/language';
import { isLanguageCode } from '../src/types/language';

export const LANGUAGES: readonly LanguageConfig[] = [
  {
    code: 'en', englishName: 'English', nativeName: 'English', script: 'Latin',
    bhashiniCode: 'en', browserLocale: 'en-IN', asr: 'unverified', tts: 'unverified',
    enabled: false, // dev/test only: enable via ENABLED_LANGUAGES=en,ta
    welcomeText: 'Hello. I am here to help you. What help do you need? Press the microphone button and speak.',
  },
  {
    code: 'ta', englishName: 'Tamil', nativeName: 'தமிழ்', script: 'Tamil',
    bhashiniCode: 'ta', browserLocale: 'ta-IN', asr: 'unverified', tts: 'unverified',
    enabled: true, ttsVoiceGender: 'female',
    welcomeText: 'வணக்கம். நான் உங்களுக்கு உதவ இங்கே இருக்கிறேன். உங்களுக்கு என்ன உதவி வேண்டும்? மைக் பொத்தானை அழுத்தி பேசுங்கள்.',
  },
  {
    code: 'hi', englishName: 'Hindi', nativeName: 'हिन्दी', script: 'Devanagari',
    bhashiniCode: 'hi', browserLocale: 'hi-IN', asr: 'unverified', tts: 'unverified',
    enabled: true, ttsVoiceGender: 'female',
    welcomeText: 'नमस्ते। मैं आपकी मदद के लिए यहाँ हूँ। आपको क्या मदद चाहिए? माइक का बटन दबाकर बोलिए।',
  },
  {
    code: 'te', englishName: 'Telugu', nativeName: 'తెలుగు', script: 'Telugu',
    bhashiniCode: 'te', browserLocale: 'te-IN', asr: 'unverified', tts: 'unverified',
    enabled: false, ttsVoiceGender: 'female',
    welcomeText: 'నమస్కారం. నేను మీకు సహాయం చేయడానికి ఇక్కడ ఉన్నాను. మీకు ఏ సహాయం కావాలి? మైక్ బటన్ నొక్కి మాట్లాడండి.',
  },
  {
    code: 'kn', englishName: 'Kannada', nativeName: 'ಕನ್ನಡ', script: 'Kannada',
    bhashiniCode: 'kn', browserLocale: 'kn-IN', asr: 'unverified', tts: 'unverified',
    enabled: false, ttsVoiceGender: 'female',
    welcomeText: 'ನಮಸ್ಕಾರ. ನಾನು ನಿಮಗೆ ಸಹಾಯ ಮಾಡಲು ಇಲ್ಲಿದ್ದೇನೆ. ನಿಮಗೆ ಯಾವ ಸಹಾಯ ಬೇಕು? ಮೈಕ್ ಬಟನ್ ಒತ್ತಿ ಮಾತನಾಡಿ.',
  },
  {
    code: 'ml', englishName: 'Malayalam', nativeName: 'മലയാളം', script: 'Malayalam',
    bhashiniCode: 'ml', browserLocale: 'ml-IN', asr: 'unverified', tts: 'unverified',
    enabled: false, ttsVoiceGender: 'female',
    welcomeText: 'നമസ്കാരം. ഞാൻ നിങ്ങളെ സഹായിക്കാൻ ഇവിടെയുണ്ട്. നിങ്ങൾക്ക് എന്ത് സഹായം വേണം? മൈക്ക് ബട്ടൺ അമർത്തി സംസാരിക്കുക.',
  },
  {
    code: 'bn', englishName: 'Bengali', nativeName: 'বাংলা', script: 'Bengali',
    bhashiniCode: 'bn', browserLocale: 'bn-IN', asr: 'unverified', tts: 'unverified',
    enabled: false, ttsVoiceGender: 'female',
    welcomeText: 'নমস্কার। আমি আপনাকে সাহায্য করতে এখানে আছি। আপনার কী সাহায্য দরকার? মাইক বোতাম চেপে কথা বলুন।',
  },
  {
    code: 'mr', englishName: 'Marathi', nativeName: 'मराठी', script: 'Devanagari',
    bhashiniCode: 'mr', browserLocale: 'mr-IN', asr: 'unverified', tts: 'unverified',
    enabled: false, ttsVoiceGender: 'female',
    welcomeText: 'नमस्कार. मी तुम्हाला मदत करण्यासाठी इथे आहे. तुम्हाला कोणती मदत हवी आहे? माइकचे बटण दाबून बोला.',
  },
  {
    code: 'gu', englishName: 'Gujarati', nativeName: 'ગુજરાતી', script: 'Gujarati',
    bhashiniCode: 'gu', browserLocale: 'gu-IN', asr: 'unverified', tts: 'unverified',
    enabled: false, // no welcomeText yet -> cannot be enabled
  },
  {
    code: 'pa', englishName: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', script: 'Gurmukhi',
    bhashiniCode: 'pa', browserLocale: 'pa-IN', asr: 'unverified', tts: 'unverified',
    enabled: false,
  },
  {
    code: 'or', englishName: 'Odia', nativeName: 'ଓଡ଼ିଆ', script: 'Oriya',
    bhashiniCode: 'or', browserLocale: 'or-IN', asr: 'unverified', tts: 'unverified',
    enabled: false,
  },
] as const;

export function getLanguage(code: LanguageCode): LanguageConfig {
  const cfg = LANGUAGES.find((l) => l.code === code);
  if (!cfg) throw new Error(`Unknown language code: ${code}`); // unreachable if LanguageCode is respected
  return cfg;
}

/**
 * @param overrideCsv value of ENABLED_LANGUAGES env var (e.g. "ta,hi,en"). Empty/undefined = use config flags.
 * Unknown codes in the override are ignored. Languages without welcomeText are never returned.
 */
export function getEnabledLanguages(overrideCsv?: string): LanguageConfig[] {
  const override = (overrideCsv ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(isLanguageCode);
  return LANGUAGES.filter((l) => (override.length > 0 ? override.includes(l.code) : l.enabled)).filter(
    (l) => Boolean(l.welcomeText),
  );
}

export function isLanguageEnabled(code: unknown, overrideCsv?: string): code is LanguageCode {
  return isLanguageCode(code) && getEnabledLanguages(overrideCsv).some((l) => l.code === code);
}

/** 'unverified' still returns true: we try, then degrade. Only 'unavailable' skips the provider. */
export function shouldTrySpeech(code: LanguageCode, kind: SpeechKind): boolean {
  return getLanguage(code)[kind] !== 'unavailable';
}

/**
 * src/types/language.ts  — STABLE INTERFACE (append-only; never rename/remove)
 *
 * Language is a PRESENTATION concern. Business logic (eligibility, state,
 * planning) must never branch on a LanguageCode. The only legitimate uses of
 * LanguageCode are:
 *   - choosing which ASR/TTS voice to call            (speech layer)
 *   - telling Gemini which language to understand/write (llm layer)
 *   - choosing which static phrase/welcome text to use  (presentation layer)
 *   - persisting state.language
 *
 * Adding a language = one entry in config/languages.ts + fallback phrases.
 * It must NEVER require a code change elsewhere.
 */

export const LANGUAGE_CODES = [
  'en', // dev/test only unless explicitly enabled
  'ta', // Tamil
  'hi', // Hindi
  'te', // Telugu
  'kn', // Kannada
  'ml', // Malayalam
  'bn', // Bengali
  'mr', // Marathi
  'gu', // Gujarati
  'pa', // Punjabi
  'or', // Odia
] as const;

export type LanguageCode = (typeof LANGUAGE_CODES)[number];

export function isLanguageCode(value: unknown): value is LanguageCode {
  return typeof value === 'string' && (LANGUAGE_CODES as readonly string[]).includes(value);
}

/**
 * 'unverified' = nobody has confirmed against the live Bhashini pipeline yet.
 * Phase 0 (human) flips these to 'available' / 'unavailable'.
 * Runtime treats 'unverified' as "try it, and degrade on failure".
 * Runtime treats 'unavailable' as "do not even try; go straight to fallback".
 */
export type SpeechCapability = 'available' | 'unavailable' | 'unverified';

/** Unicode script names usable in RegExp \p{Script=...}. Used to sanity-check LLM output language. */
export type UnicodeScript =
  | 'Latin'
  | 'Tamil'
  | 'Devanagari'
  | 'Telugu'
  | 'Kannada'
  | 'Malayalam'
  | 'Bengali'
  | 'Gujarati'
  | 'Gurmukhi'
  | 'Oriya';

export interface LanguageConfig {
  code: LanguageCode;
  englishName: string;
  /** Name written in its own script. Shown on the language-picker button (user may not read English). */
  nativeName: string;
  script: UnicodeScript;
  /** Identifier sent to Bhashini (sourceLanguage / targetLanguage). Confirm against live Bhashini config. */
  bhashiniCode: string;
  /** BCP-47 locale for browser SpeechRecognition / speechSynthesis fallback. */
  browserLocale: string;
  asr: SpeechCapability;
  tts: SpeechCapability;
  /** Only enabled languages appear in the UI and are accepted by the API. */
  enabled: boolean;
  /** Preferred TTS voice gender if the provider offers a choice. */
  ttsVoiceGender?: 'female' | 'male';
  /**
   * Static greeting spoken/shown when the language is first selected.
   * Static on purpose: it must work with NO Gemini call. Needs native-speaker review.
   * A language MUST NOT be enabled unless this exists (enforced by test).
   */
  welcomeText?: string;
}

export type SpeechKind = 'asr' | 'tts';

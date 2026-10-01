import { NextResponse } from 'next/server';
import { getEnv } from '@/src/server/env/config';
import { getEnabledLanguages, shouldTrySpeech } from '@/config/languages';
import type { LanguagesResponse } from '@/src/types/api';

export async function GET() {
  const env = getEnv();
  const enabledLanguages = getEnabledLanguages(env.ENABLED_LANGUAGES);

  const languages: LanguagesResponse['languages'] = enabledLanguages.map((lang) => ({
    code: lang.code,
    nativeName: lang.nativeName,
    asrAvailable: shouldTrySpeech(lang.code, 'asr'),
    ttsAvailable: shouldTrySpeech(lang.code, 'tts'),
    welcomeText: lang.welcomeText || '',
  }));

  return NextResponse.json({ ok: true, data: { languages } });
}

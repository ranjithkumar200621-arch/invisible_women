import { z } from 'zod';

const envSchema = z.object({
  // App
  APP_ENV: z.enum(['development', 'test', 'production']),
  DEFAULT_LANGUAGE: z.string(),
  ENABLED_LANGUAGES: z.string().optional(),
  ACTIVE_SCHEME_ID: z.string(),
  SCHEME_SOURCE: z.enum(['file', 'supabase', 'supabase_with_file_fallback']),
  ALLOW_DRAFT_SCHEMES: z.string().transform((val) => val === 'true'),
  SCHEME_STALE_AFTER_DAYS: z.coerce.number().int().positive(),
  SESSION_TTL_HOURS: z.coerce.number().int().positive(),
  RATE_LIMIT_TURNS_PER_MIN: z.coerce.number().int().positive(),
  LOG_CONTENT: z.string().transform((val) => val === 'true'),

  // Gemini (server only)
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string(),
  GEMINI_TIMEOUT_MS: z.coerce.number().int().positive(),
  GEMINI_UNDERSTAND_TEMPERATURE: z.coerce.number(),
  GEMINI_COMPOSE_TEMPERATURE: z.coerce.number(),

  // Bhashini (server only)
  BHASHINI_USER_ID: z.string().optional(),
  BHASHINI_ULCA_API_KEY: z.string().optional(),
  BHASHINI_PIPELINE_ID: z.string().optional(),
  BHASHINI_ASR_TIMEOUT_MS: z.coerce.number().int().positive(),
  BHASHINI_TTS_TIMEOUT_MS: z.coerce.number().int().positive(),
  ENABLE_BHASHINI_ASR: z.string().transform((val) => val === 'true'),
  ENABLE_BHASHINI_TTS: z.string().transform((val) => val === 'true'),

  // Supabase (server only)
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_TIMEOUT_MS: z.coerce.number().int().positive(),

  // Public (non-secret, safe in browser)
  NEXT_PUBLIC_ENABLE_BROWSER_SPEECH: z.string().transform((val) => val === 'true'),
  NEXT_PUBLIC_MAX_RECORDING_SECONDS: z.coerce.number().int().positive(),
});

export type Env = z.infer<typeof envSchema>;

let env: Env | null = null;

export function getEnv(): Env {
  if (!env) {
    const parsed = envSchema.safeParse({
      APP_ENV: process.env.APP_ENV || 'development',
      DEFAULT_LANGUAGE: process.env.DEFAULT_LANGUAGE || 'ta',
      ENABLED_LANGUAGES: process.env.ENABLED_LANGUAGES,
      ACTIVE_SCHEME_ID: process.env.ACTIVE_SCHEME_ID || 'example-housing-001',
      SCHEME_SOURCE: process.env.SCHEME_SOURCE || 'file',
      ALLOW_DRAFT_SCHEMES: process.env.ALLOW_DRAFT_SCHEMES || 'true',
      SCHEME_STALE_AFTER_DAYS: process.env.SCHEME_STALE_AFTER_DAYS || '90',
      SESSION_TTL_HOURS: process.env.SESSION_TTL_HOURS || '24',
      RATE_LIMIT_TURNS_PER_MIN: process.env.RATE_LIMIT_TURNS_PER_MIN || '20',
      LOG_CONTENT: process.env.LOG_CONTENT || 'false',
      GEMINI_API_KEY: process.env.GEMINI_API_KEY,
      GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      GEMINI_TIMEOUT_MS: process.env.GEMINI_TIMEOUT_MS || '8000',
      GEMINI_UNDERSTAND_TEMPERATURE: process.env.GEMINI_UNDERSTAND_TEMPERATURE || '0',
      GEMINI_COMPOSE_TEMPERATURE: process.env.GEMINI_COMPOSE_TEMPERATURE || '0.3',
      BHASHINI_USER_ID: process.env.BHASHINI_USER_ID,
      BHASHINI_ULCA_API_KEY: process.env.BHASHINI_ULCA_API_KEY,
      BHASHINI_PIPELINE_ID: process.env.BHASHINI_PIPELINE_ID,
      BHASHINI_ASR_TIMEOUT_MS: process.env.BHASHINI_ASR_TIMEOUT_MS || '10000',
      BHASHINI_TTS_TIMEOUT_MS: process.env.BHASHINI_TTS_TIMEOUT_MS || '8000',
      ENABLE_BHASHINI_ASR: process.env.ENABLE_BHASHINI_ASR || 'true',
      ENABLE_BHASHINI_TTS: process.env.ENABLE_BHASHINI_TTS || 'true',
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      SUPABASE_TIMEOUT_MS: process.env.SUPABASE_TIMEOUT_MS || '3000',
      NEXT_PUBLIC_ENABLE_BROWSER_SPEECH: process.env.NEXT_PUBLIC_ENABLE_BROWSER_SPEECH || 'true',
      NEXT_PUBLIC_MAX_RECORDING_SECONDS: process.env.NEXT_PUBLIC_MAX_RECORDING_SECONDS || '15',
    });

    if (!parsed.success) {
      console.error('Environment variable validation failed:', parsed.error.format());
      throw new Error('Invalid environment configuration');
    }

    env = parsed.data;

    // Safety checks
    if (env.APP_ENV === 'production' && env.ALLOW_DRAFT_SCHEMES) {
      throw new Error('ALLOW_DRAFT_SCHEMES must be false in production');
    }
  }
  return env;
}

export function isDevelopment(): boolean {
  return getEnv().APP_ENV === 'development';
}

export function isProduction(): boolean {
  return getEnv().APP_ENV === 'production';
}

export function isTest(): boolean {
  return getEnv().APP_ENV === 'test';
}
/**
 * src/server/supabase/sessionStore.ts — Supabase session persistence
 *
 * Provides async loadSession() and saveSession() using Supabase.
 * Falls back to in-memory storage if Supabase is not configured.
 */

import { createClient } from '@supabase/supabase-js';
import type { ConversationState } from '@/src/types/conversation';
import type { Env } from '@/src/server/env/config';

let supabase: any | null = null;
let env: Env | null = null;

/**
 * Initialize Supabase client if credentials are available.
 */
export function initSupabase(getEnv: () => Env) {
  env = getEnv();
  
  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    supabase = createClient(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: { persistSession: false },
        global: { headers: { 'Accept': 'application/json' } },
      }
    );
    console.log('[Supabase] Client initialized');
  } else {
    console.log('[Supabase] Not configured - using in-memory fallback');
    supabase = null;
  }
}

/**
 * In-memory fallback storage (for in-process testing only).
 */
const memorySessions: Record<string, ConversationState> = {};

/**
 * Load or create a session from Supabase.
 * If Supabase is unavailable, falls back to in-memory storage.
 */
export async function loadSession(sessionId: string): Promise<ConversationState> {
  // Check if we have a Supabase client
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('session_id', sessionId)
        .single();

      if (error) {
        // Session doesn't exist - create new one
        if (error.code === 'PGRST116') {
          console.log('[Supabase] Session not found');
          return createNewSession(sessionId);
        }
        console.error('[Supabase] Load error:', error.message);
      }

      if (data && data.state) {
        return data.state;
      }
    } catch (err) {
      console.error('[Supabase] Load exception:', err);
    }
  }

  // Fallback to in-memory (for testing or when Supabase unavailable)
  if (!memorySessions[sessionId]) {
    memorySessions[sessionId] = createDefaultSession(sessionId);
  }
  return memorySessions[sessionId];
}

/**
 * Save session to Supabase.
 * If Supabase is unavailable, falls back to in-memory storage.
 */
export async function saveSession(sessionId: string, state: ConversationState): Promise<void> {
  // Check if we have a Supabase client
  if (supabase) {
    try {
      const { error } = await supabase
        .from('sessions')
        .upsert({
          session_id: sessionId,
          state: state,
          updated_at: new Date().toISOString(),
        })
        .eq('session_id', sessionId);

      if (error) {
        console.error('[Supabase] Save error:', error.message);
      } else {
        console.log('[Supabase] Session saved:', sessionId);
      }
    } catch (err) {
      console.error('[Supabase] Save exception:', err);
    }
  }

  // Always save to in-memory fallback (for single-instance operation)
  memorySessions[sessionId] = state;
}

/**
 * Create a new session with default values.
 */
function createNewSession(sessionId: string): ConversationState {
  const now = new Date().toISOString();
  const ttlHours = env?.SESSION_TTL_HOURS || 24;
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();

  return createDefaultSession(sessionId, now, expiresAt);
}

/**
 * Create default session state.
 */
function createDefaultSession(
  sessionId: string,
  now: string = new Date().toISOString(),
  expiresAt: string = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
): ConversationState {
  return {
    version: 1,
    sessionId,
    language: 'ta' as const,
    schemeId: null,
    schemeVersion: null,
    currentStep: 'intent_discovery' as const,
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
    expiresAt: expiresAt,
  };
}

/**
 * Get a health status for the session store.
 */
export function getSessionStoreHealth(): 'ok' | 'missing_key' | 'error' {
  if (!supabase) return 'missing_key';
  return 'ok';
}

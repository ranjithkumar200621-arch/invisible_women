/**
 * src/types/api.ts — STABLE INTERFACE: HTTP contract between the web client and Next.js API routes.
 *
 * All routes return ApiEnvelope<T>. Domain/provider failures that the client can
 * recover from are returned as HTTP 200 with a usable `data` and `degraded` flags
 * (graceful degradation), NOT as errors. HTTP 4xx/5xx only for malformed requests,
 * rate limiting and genuinely unexpected failures.
 */
import type { ConversationState, QuickReplyId } from './conversation';
import type { EligibilityStatus } from './eligibility';
import type { LanguageCode } from './language';
import type { ApplicationStep, BenefitItem, DocumentItem, Helpline } from './scheme';

export type ErrorCode =
  | 'ASR_FAILED'
  | 'ASR_EMPTY'
  | 'TTS_FAILED'
  | 'LLM_TIMEOUT'
  | 'LLM_MALFORMED'
  | 'LLM_FAILED'
  | 'DB_UNAVAILABLE'
  | 'UNSUPPORTED_LANGUAGE'
  | 'SCHEME_UNAVAILABLE'
  | 'INVALID_INPUT'
  | 'RATE_LIMITED'
  | 'SESSION_EXPIRED'
  | 'NETWORK_TIMEOUT'
  | 'INTERNAL';

export interface ApiError {
  code: ErrorCode;
  /** English, developer-facing. Never shown to the user. Must not contain user content. */
  message: string;
  retryable: boolean;
}

export type ApiEnvelope<T> = { ok: true; data: T } | { ok: false; error: ApiError };

// ---- shared response pieces ------------------------------------------------

export interface QuickReply {
  id: QuickReplyId;
  /** Icon name from the client icon set. UI is icon-first; text is optional. */
  icon: 'check' | 'cross' | 'question' | 'repeat' | 'document' | 'steps' | 'rupee' | 'info' | 'restart';
  /** Localized short label (from compose or fallback phrases). May be absent; icon must suffice. */
  label?: string;
}

export interface DegradationFlags {
  /** Which subsystem fell back during this turn. Client uses it to switch modes / show icons. */
  llm?: 'static_fallback';
  tts?: 'unavailable';
  db?: 'file_fallback' | 'stateless';
  dataFreshness?: 'stale';
}

export interface AssistantReply {
  text: string;
  language: LanguageCode;
  quickReplies: QuickReply[];
}

// ---- cards: rendered from DB data + localized item text; verdict is backend-owned ----

export interface VerdictCard {
  type: 'verdict';
  /** Drives icon/colour. Computed by the engine, never by Gemini. */
  status: EligibilityStatus;
  schemeName: string;
  reasonCodes: string[];
}
export interface BenefitsCard { type: 'benefits'; items: Array<BenefitItem & { localizedText?: string }> }
export interface DocumentsCard { type: 'documents'; items: Array<DocumentItem & { localizedName?: string; localizedDescription?: string }> }
export interface StepsCard { type: 'steps'; items: Array<ApplicationStep & { localizedText?: string }> }
export interface LinkCard {
  type: 'link';
  /** From the Scheme record only. Never from Gemini output. */
  url: string;
  helplines: Helpline[];
  /** ISO date the data was verified; shown as "last checked". */
  verifiedAt: string | null;
}
export type UiCard = VerdictCard | BenefitsCard | DocumentsCard | StepsCard | LinkCard;

// ---- POST /api/session ----------------------------------------------------

export interface CreateSessionRequest { language: LanguageCode }
export interface CreateSessionResponse {
  state: ConversationState;
  reply: AssistantReply; // static welcome text
}

// ---- POST /api/turn -------------------------------------------------------

export type TurnInput =
  | { mode: 'voice'; text: string } // transcript produced by ASR (Bhashini or browser)
  | { mode: 'text'; text: string }
  | { mode: 'tap'; quickReply: QuickReplyId };

export interface TurnRequest {
  sessionId: string;
  input: TurnInput;
  /**
   * Client echoes the last state it received. Used ONLY when the session store is
   * unavailable/expired (stateless fallback). Server validates it with zod and
   * ignores it whenever the stored session loads fine.
   */
  stateSnapshot?: ConversationState;
}

export interface TurnResponse {
  state: ConversationState;
  reply: AssistantReply;
  cards: UiCard[];
  degraded: DegradationFlags;
}

// ---- POST /api/asr --------------------------------------------------------

export interface AsrRequest {
  language: LanguageCode;
  audioBase64: string; // 16 kHz mono PCM WAV, base64 (client converts; see ARCHITECTURE §6)
  mimeType: 'audio/wav';
}
export interface AsrResponse {
  transcript: string;
  provider: 'bhashini';
}

// ---- POST /api/tts --------------------------------------------------------

export interface TtsRequest { language: LanguageCode; text: string }
export interface TtsResponse {
  audioBase64: string;
  mimeType: 'audio/wav' | 'audio/mpeg';
  provider: 'bhashini';
}

// ---- GET /api/languages ---------------------------------------------------

export interface LanguagesResponse {
  languages: Array<{
    code: LanguageCode;
    nativeName: string;
    asrAvailable: boolean;
    ttsAvailable: boolean;
    welcomeText: string;
  }>;
}

// ---- GET /api/health ------------------------------------------------------

export interface HealthResponse {
  gemini: 'ok' | 'missing_key' | 'error';
  bhashini: 'ok' | 'missing_key' | 'error';
  supabase: 'ok' | 'missing_key' | 'error';
  schemeLoaded: boolean;
  activeSchemeId: string | null;
}

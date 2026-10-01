/**
 * src/types/conversation.ts — STABLE INTERFACE
 *
 * Contains:
 *   1. ConversationState  — the explicit, server-owned session state (NOT the LLM's memory)
 *   2. UserIntent         — language-neutral intent vocabulary
 *   3. Gemini "understand" I/O  — extraction only; no eligibility, no prose
 *   4. ResponsePlan       — deterministic planner output; the ONLY input to "compose"
 *   5. Gemini "compose" I/O     — turns a plan into simple language in the user's language
 *
 * Key rule: the planner (pure TypeScript) decides WHAT to say next.
 * Gemini only decides HOW to say it (words), never WHAT (facts/verdict/next step).
 */
import type {
  EligibilityResult, FactKey, FactMap, FactValue,
} from './eligibility';
import type { LanguageCode } from './language';
import type {
  ApplicationStep, BenefitItem, DocumentItem, Helpline, SchemeBrief,
} from './scheme';

// ---------------------------------------------------------------------------
// 1. Conversation state
// ---------------------------------------------------------------------------

export const STATE_SCHEMA_VERSION = 1;

export type ConversationStep =
  | 'language_selection'
  | 'intent_discovery' // "what help do you need?"
  | 'collecting_facts' // asking one question at a time
  | 'eligibility_result' // verdict delivered
  | 'documents' // documents explained
  | 'application_guidance' // steps + official destination delivered
  | 'completed';

export type Confidence = 'high' | 'medium' | 'low';

export interface FactMeta {
  collectedAtTurn: number;
  confidence: Confidence;
  source: 'spoken' | 'typed' | 'tap' | 'corrected';
}

/** What the system is currently waiting for the user to answer. Drives interpretation of short replies like "yes". */
export type PendingQuestion =
  | { kind: 'ask_field'; field: FactKey }
  | { kind: 'confirm_fact'; field: FactKey; proposedValue: FactValue }
  | { kind: 'clarify_income_period'; amount: number } // user gave per-day / ambiguous amount
  | { kind: 'confirm_scheme'; schemeId: string }
  | { kind: 'offer_next'; offer: 'documents' | 'how_to_apply' };

export type AsrMode = 'bhashini' | 'browser' | 'text';
export type TtsMode = 'bhashini' | 'browser' | 'text';

export interface VoiceState {
  asr: AsrMode;
  tts: TtsMode;
  consecutiveAsrFailures: number;
  consecutiveTtsFailures: number;
}

export interface LastReply {
  text: string;
  planAction: ResponsePlan['action'];
}

export interface ConversationState {
  version: typeof STATE_SCHEMA_VERSION;
  sessionId: string;
  language: LanguageCode;
  schemeId: string | null;
  schemeVersion: number | null;
  currentStep: ConversationStep;

  /** Canonical, language-neutral facts. THE source of truth for the engine. */
  facts: FactMap;
  factMeta: Partial<Record<FactKey, FactMeta>>;

  /** How many times each field has been asked (drives "never repeat unnecessarily" and give-up logic). */
  askedCount: Partial<Record<FactKey, number>>;
  /** Fields the user could not/would not answer. Never asked again. */
  unanswerableFields: FactKey[];
  /** Cached from the last engine run, ordered by askOrder. */
  missingFields: FactKey[];

  pendingQuestion: PendingQuestion | null;
  lastEligibility: EligibilityResult | null;
  lastReply: LastReply | null;
  voice: VoiceState;

  counters: {
    turns: number;
    consecutiveUnclear: number;
    consecutiveLanguageMismatch: number;
  };

  createdAt: string; // ISO-8601
  lastUpdated: string; // ISO-8601
  expiresAt: string; // ISO-8601
}

// ---------------------------------------------------------------------------
// 2. Language-neutral intents
// ---------------------------------------------------------------------------

export const USER_INTENTS = [
  'find_scheme', // "I need help building a house" (any language)
  'provide_info', // answering a question / volunteering facts
  'confirm_yes',
  'confirm_no',
  'correct_info', // "no, I'm 35, not 32"
  'dont_know', // "I don't know my income"
  'ask_benefits',
  'ask_documents',
  'ask_how_to_apply',
  'ask_why', // "why am I not eligible?"
  'repeat_last', // "say that again"
  'restart',
  'change_language',
  'unsupported_request', // wants something outside the supported scheme(s)
  'smalltalk', // greeting/thanks
  'unclear', // unintelligible / off-topic noise
] as const;
export type UserIntent = (typeof USER_INTENTS)[number];

/** Tap targets in the UI. Deterministically mapped to intents: NO Gemini call needed for taps. */
export type QuickReplyId =
  | 'yes' | 'no' | 'dont_know' | 'repeat'
  | 'documents' | 'how_to_apply' | 'benefits' | 'why' | 'restart';

export const QUICK_REPLY_TO_INTENT: Record<QuickReplyId, UserIntent> = {
  yes: 'confirm_yes',
  no: 'confirm_no',
  dont_know: 'dont_know',
  repeat: 'repeat_last',
  documents: 'ask_documents',
  how_to_apply: 'ask_how_to_apply',
  benefits: 'ask_benefits',
  why: 'ask_why',
  restart: 'restart',
};

// ---------------------------------------------------------------------------
// 3. Gemini "understand" call
// ---------------------------------------------------------------------------

export type IncomePeriod = 'day' | 'week' | 'month' | 'year' | 'unspecified';

export interface ExtractedFact {
  field: FactKey;
  /**
   * Always a string; the BACKEND coerces/validates per FACT_DEFINITIONS.
   * Numbers as Western digits ("32", "120000"), booleans as "true"/"false",
   * enums as the exact canonical enum value, state as a state code ("TN").
   */
  rawValue: string;
  /** Only meaningful for annual_income; null otherwise. Backend does the arithmetic. */
  period: IncomePeriod | null;
  confidence: Confidence;
}

export interface UnderstandInput {
  language: LanguageCode;
  /** Sanitised transcript or typed text. Already stripped of Aadhaar/OTP-like patterns. */
  utterance: string;
  /** The field we just asked about, if any. Lets Gemini resolve "thirty two" -> age. */
  expectedField: FactKey | null;
  /** Describes pendingQuestion in a language-neutral way so "yes" can be interpreted. */
  pendingKind: PendingQuestion['kind'] | null;
  /** Closed set for intent matching. Gemini may only return one of these ids or null. */
  schemeCandidates: SchemeBrief[];
  /** Keys only (no values) of facts we already know, so Gemini doesn't re-extract. */
  knownFactKeys: FactKey[];
}

export interface UnderstandOutput {
  schemaVersion: 1;
  intent: UserIntent;
  /** Language Gemini believes the utterance is in. 'unknown' if it can't tell. */
  detectedLanguage: LanguageCode | 'unknown';
  matchedSchemeId: string | null; // must be in schemeCandidates or null
  extractedFacts: ExtractedFact[];
  yesNo: 'yes' | 'no' | 'unsure' | null;
  /** True if the utterance was empty/noise/unintelligible. */
  unintelligible: boolean;
  confidence: Confidence;
}

// ---------------------------------------------------------------------------
// 4. ResponsePlan — output of the deterministic planner
// ---------------------------------------------------------------------------

export type DisclaimerCode =
  | 'BASED_ON_YOUR_ANSWERS' // "this is based on what you told me"
  | 'NOT_OFFICIAL_DECISION' // "the government office makes the final decision"
  | 'VERIFY_ON_OFFICIAL_SITE'; // "details can change; check the official place"

export type DataFreshness = 'current' | 'stale';

export type ResponsePlan =
  | { action: 'greet' } // static text from config; no Gemini
  | { action: 'ask_scheme_intent' }
  | { action: 'unsupported_request'; supported: SchemeBrief[] }
  | { action: 'start_scheme_and_ask'; scheme: SchemeBrief; field: FactKey; attempt: number }
  | { action: 'ask_field'; field: FactKey; attempt: number; simplify: boolean }
  | { action: 'confirm_fact'; field: FactKey; proposedValue: FactValue }
  | { action: 'clarify_income_period'; amount: number }
  | { action: 'confirm_scheme'; scheme: SchemeBrief }
  | {
      action: 'present_result';
      scheme: SchemeBrief;
      result: EligibilityResult;
      unanswerableFields: FactKey[];
      benefits: BenefitItem[];
      disclaimers: DisclaimerCode[];
      dataFreshness: DataFreshness;
    }
  | { action: 'explain_reasons'; scheme: SchemeBrief; result: EligibilityResult }
  | { action: 'present_benefits'; scheme: SchemeBrief; benefits: BenefitItem[] }
  | { action: 'present_documents'; scheme: SchemeBrief; documents: DocumentItem[] }
  | {
      action: 'present_application_steps';
      scheme: SchemeBrief;
      steps: ApplicationStep[];
      helplines: Helpline[];
      /** Shown on screen as button + QR. Compose is told to say "the official website is shown on your screen". */
      hasOfficialUrl: true;
      disclaimers: DisclaimerCode[];
    }
  | { action: 'clarify_unclear'; reason: 'unintelligible' | 'off_topic' }
  | { action: 'privacy_warning' } // user spoke an Aadhaar/OTP-like number
  | { action: 'repeat_last' } // replays state.lastReply; no Gemini
  | { action: 'offer_language_switch'; to: LanguageCode }
  | { action: 'error'; code: import('./api').ErrorCode }
  | { action: 'farewell' };

// ---------------------------------------------------------------------------
// 5. Gemini "compose" call
// ---------------------------------------------------------------------------

export interface ComposeInput {
  language: LanguageCode;
  languageEnglishName: string;
  plan: ResponsePlan;
  /** Hard limits so audio stays short. */
  maxSentences: number;
  /**
   * For list-type plans (benefits/documents/steps): ids Gemini MUST return
   * simplified translations for, one entry per id, no more, no fewer.
   */
  requiredItemIds: string[];
}

export interface ComposeItem {
  id: string; // must equal one of requiredItemIds
  text: string; // simple translation in the user's language
}

export interface ComposeOutput {
  schemaVersion: 1;
  /** What will be shown AND spoken. Plain, short, no markdown, no URLs, no emoji. */
  replyText: string;
  /** Localized text for list items (shown in cards). Empty for non-list plans. */
  items: ComposeItem[];
}

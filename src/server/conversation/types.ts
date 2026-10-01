/**
 * src/server/conversation/types.ts — Conversation state manager types
 */

import type { FactKey, FactMap, EligibilityResult } from '@/src/types/eligibility';
import type { LanguageCode } from '@/src/types/language';
import type { Scheme } from '@/src/types/scheme';

export interface GeminiExtraction {
  intent: 'find_scheme' | 'eligibility' | 'smalltalk' | 'restart' | 'repeat_last' | 'correct_info' | 'ask_benefits' | 'ask_documents' | 'ask_how_to_apply' | 'unsupported_request';
  extractedFacts: Record<FactKey, any>;
  missingFields: FactKey[];
  confidence: 'high' | 'medium' | 'low';
  matchedSchemeId?: string;
  /** True if the utterance was empty/noise/unintelligible. */
  unintelligible: boolean;
}

export interface ChatResponse {
  response: string;
  state: Partial<ConversationState>;
  status: 'needs_information' | 'eligible' | 'not_eligible' | 'undetermined';
  eligibilityResult?: EligibilityResult;
  nextField?: FactKey;
}

export type ConversationStep =
  | 'language_selection'
  | 'intent_discovery' // "what help do you need?"
  | 'collecting_facts' // asking one question at a time
  | 'eligibility_result' // verdict delivered
  | 'documents' // documents explained
  | 'application_guidance' // steps + official destination delivered
  | 'completed';

export interface ConversationState {
  sessionId: string;
  language: LanguageCode;
  schemeId: string | null;
  currentStep: ConversationStep;
  facts: FactMap;
  missingFields: FactKey[];
  lastEligibility: EligibilityResult | null;
  askedCount: Partial<Record<FactKey, number>>;
  unanswerableFields: FactKey[];
  scheme: Scheme | null;
  schemeVersion: number | null;
}

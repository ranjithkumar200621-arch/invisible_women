/**
 * src/server/conversation/types.ts — Conversation state manager types
 */

import type { FactKey, FactMap, EligibilityResult } from '@/src/types/eligibility';
import type { LanguageCode } from '@/src/types/language';

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

export interface ConversationState {
  sessionId: string;
  language: LanguageCode;
  schemeId: string | null;
  currentStep: 'intent_discovery' | 'collecting_facts' | 'eligibility_result';
  facts: FactMap;
  missingFields: FactKey[];
  lastEligibility: EligibilityResult | null;
  askedCount: Partial<Record<FactKey, number>>;
  unanswerableFields: FactKey[];
}

/**
 * src/server/conversation/service.ts — Conversation state manager
 *
 * Manages conversation state, calls Gemini for extraction,
 * and coordinates with the deterministic eligibility engine.
 */

import { evaluateEligibility } from '@/src/server/engine/engine';
import { EXAMPLE_SCHEME_JSON } from '@/tests/engine/example-scheme';
import type {
  ConversationState,
  ChatResponse,
} from './types';
import type { LanguageCode } from '@/src/types/language';
import { extractIntentAndFacts, composeResponse } from './gemini';

// In-memory session storage (for MVP only - replace with database in production)
const sessions: Record<string, ConversationState> = {};

/**
 * Load or create conversation state for a session.
 */
export function loadSession(sessionId: string): ConversationState {
  if (!sessions[sessionId]) {
    sessions[sessionId] = {
      sessionId,
      language: 'ta' as LanguageCode,
      schemeId: 'example-housing-001',
      currentStep: 'intent_discovery',
      facts: {},
      missingFields: [],
      lastEligibility: null,
      askedCount: {},
      unanswerableFields: [],
    };
  }
  return sessions[sessionId];
}

/**
 * Save conversation state.
 */
export function saveSession(sessionId: string, state: ConversationState): void {
  sessions[sessionId] = state;
}

/**
 * Process a user message and return the response.
 *
 * Flow:
 * 1. Load/create conversation state
 * 2. Send to Gemini for extraction IF GEMINI_API_KEY is configured
 * 3. Fallback to keyword-based extraction if Gemini fails/unavailable
 * 4. Merge extracted facts into state
 * 5. Call eligibility engine
 * 6. Return response with eligibility status
 */
export async function processMessage(
  sessionId: string,
  message: string,
  language: LanguageCode = 'ta'
): Promise<ChatResponse> {
  let state = loadSession(sessionId);
  
  if (language) {
    state.language = language;
  }

  const msgLower = message.toLowerCase();

  // Check for restart
  if (msgLower.includes('restart') || msgLower.includes('start over') || msgLower.includes('மீண்டும்') || msgLower.includes('start')) {
    state = {
      ...state,
      facts: {},
      currentStep: 'intent_discovery',
      missingFields: [],
      lastEligibility: null,
    };
    return {
      response: language === 'ta' ? 'தொடங்குகிறோம்!' : 'Let us start!',
      state: { ...state },
      status: 'needs_information',
    };
  }

  let extractedFacts: Record<string, any> = {};
  let nextQuestion = '';
  let responseText = '';
  let intent: string = 'eligibility';

  // Try Gemini extraction if API key is configured
  try {
    if (process.env.GEMINI_API_KEY) {
      const geminiResult = await extractIntentAndFacts(
        message,
        language,
        state.schemeId || undefined
      );

      intent = geminiResult.intent;
      extractedFacts = geminiResult.extractedFacts;
      responseText = geminiResult.response;
      nextQuestion = geminiResult.nextQuestion;
    } else {
      // Fallback to keyword-based extraction
      const keywordResult = extractWithKeywords(message, state.schemeId, language);
      extractedFacts = keywordResult.extractedFacts;
      nextQuestion = keywordResult.nextQuestion;
      intent = keywordResult.intent;
    }
  } catch (error) {
    console.error('Gemini extraction failed, using fallback:', error);
    // Fallback to keyword-based extraction
    const keywordResult = extractWithKeywords(message, state.schemeId, language);
    extractedFacts = keywordResult.extractedFacts;
    nextQuestion = keywordResult.nextQuestion;
    intent = keywordResult.intent;
  }

  // Merge extracted facts into state
  state = mergeFacts(state, extractedFacts);

  // Calculate eligibility using the deterministic engine
  const engineResult = evaluateEligibility(state.facts, EXAMPLE_SCHEME_JSON);
  state.missingFields = engineResult.missingFields;
  state.lastEligibility = engineResult;

  // Generate response based on eligibility status
  if (engineResult.status === 'eligible') {
    return {
      response: responseText || (language === 'ta'
        ? 'உங்கள் விவரங்களை பார்த்தால், நீங்கள் இந்த திட்டத்திற்கு தகுதிவாய்ந்தவராக தெரிகிறீர்கள்!'
        : 'Based on your information, you are eligible for this scheme!'),
      state: { ...state, currentStep: 'eligibility_result' },
      status: 'eligible',
      eligibilityResult: engineResult,
    };
  } else if (engineResult.status === 'not_eligible') {
    return {
      response: responseText || (language === 'ta'
        ? 'மன்னிக்கவும், நீங்கள் இந்த திட்டத்திற்கு தகுதிவாய்ந்தவராக தெரியவில்லை.'
        : 'You are not eligible for this scheme.'),
      state: { ...state, currentStep: 'eligibility_result' },
      status: 'not_eligible',
      eligibilityResult: engineResult,
    };
  } else {
    // undetermined - ask next question
    if (nextQuestion) {
      return {
        response: nextQuestion,
        state: { ...state, currentStep: 'collecting_facts' },
        status: 'needs_information',
      };
    }

    // Generate question based on missing fields
    const nextField = getNextFieldToAsk(engineResult, state.unanswerableFields);
    if (nextField) {
      return {
        response: language === 'ta'
          ? `உங்கள் ${nextField} என்ன?`
          : `What is your ${nextField}?`,
        state: { ...state, currentStep: 'collecting_facts' },
        status: 'needs_information',
        nextField,
      };
    }

    return {
      response: language === 'ta'
        ? 'தகுதியை உறுதி செய்ய முடியவில்லை. தயவு செய்து உங்கள் விவரங்களை சரிபார்க்கவும்.'
        : 'Unable to determine eligibility. Please check your details.',
      state: { ...state, currentStep: 'eligibility_result' },
      status: 'undetermined',
      eligibilityResult: engineResult,
    };
  }
}

/**
 * Extract facts using keyword matching as fallback.
 */
export function extractWithKeywords(
  message: string,
  currentSchemeId: string | null,
  language: string
): { extractedFacts: Record<string, any>; nextQuestion: string; intent: string } {
  const extractedFacts: Record<string, any> = {};
  const msgLower = message.toLowerCase();

  // Age
  const ageMatch = message.match(/(\d+)\s*(வயது|years?|age)/i);
  if (ageMatch) {
    const age = parseInt(ageMatch[1], 10);
    if (!isNaN(age) && age >= 0 && age <= 150) {
      extractedFacts.age = age;
    }
  }

  // Income
  const incomeMatch = message.match(/(\d+)\s*(ரூ|rupees?|₹|inr)/i);
  if (incomeMatch) {
    const income = parseInt(incomeMatch[1], 10);
    if (!isNaN(income) && income >= 0) {
      extractedFacts.annual_income = income;
    }
  }

  // State
  const statePatterns: Record<string, string> = {
    'tamil nadu': 'TN',
    'தமிழ்நாடு': 'TN',
    'karnataka': 'KA',
    'maharashtra': 'MH',
  };
  for (const [name, code] of Object.entries(statePatterns)) {
    if (msgLower.includes(name)) {
      extractedFacts.state = code;
      break;
    }
  }

  // Occupation
  const occupationPatterns: Record<string, string> = {
    'farmer': 'farmer',
    'நிலவரிசையாளர்': 'farmer',
    'government employee': 'government_employee',
  };
  for (const [key, value] of Object.entries(occupationPatterns)) {
    if (msgLower.includes(key)) {
      extractedFacts.occupation = value;
      break;
    }
  }

  // owns_house
  if (msgLower.includes('இல்லை') || msgLower.includes('dont') || msgLower.includes('no house')) {
    extractedFacts.owns_house = false;
  }

  // marital_status
  if (msgLower.includes('விதிவிலக்கு') || msgLower.includes('widow')) {
    extractedFacts.marital_status = 'widowed';
  }

  // Determine intent
  let intent: string = 'eligibility';
  
  // Check for women's assistance request - guide toward current scheme or find_scheme
  if (msgLower.includes('பெண்குக்கான') || msgLower.includes('பெண்களுக்கான') || msgLower.includes('பெண் திட்ட') || msgLower.includes('women') || msgLower.includes('பெண் உதவி')) {
    if (currentSchemeId) {
      intent = 'eligibility';
    } else {
      intent = 'find_scheme';
    }
  }
  
  if (msgLower.includes('வீடு') || msgLower.includes('house') || msgLower.includes('housing') || msgLower.includes('திட்ட')) {
    if (!currentSchemeId) {
      intent = 'find_scheme';
    }
  }

  // Generate next question - don't ask "which scheme" if they're asking about assistance
  let nextQuestion = '';
  if (intent === 'find_scheme' && Object.keys(extractedFacts).length === 0 && 
      !msgLower.includes('பெண்குக்கான') && !msgLower.includes('பெண்களுக்கான') && 
      !msgLower.includes('பெண் திட்ட') && !msgLower.includes('women') && 
      !msgLower.includes('பெண் உதவி')) {
    nextQuestion = language === 'ta'
      ? 'எந்த திட்டத்தைப் பற்றி கேள்வி கேக்கிறீர்கள்?'
      : 'Which scheme are you asking about?';
  }

  return { extractedFacts, nextQuestion, intent };
}

/**
 * Merge extracted facts into state.
 */
function mergeFacts(state: ConversationState, extracted: Record<string, any>): ConversationState {
  const newFacts = { ...state.facts };
  const newAskedCount = { ...state.askedCount };

  for (const [key, value] of Object.entries(extracted)) {
    const coerced = coerceFactValue(key as any, value);
    if (coerced !== undefined) {
      (newFacts as any)[key] = coerced;
      (newAskedCount as any)[key] = ((newAskedCount as any)[key] || 0) + 1;
    }
  }

  return {
    ...state,
    facts: newFacts,
    askedCount: newAskedCount,
  };
}

/**
 * Determine next field to ask.
 */
function getNextFieldToAsk(result: any, unanswerable: string[]): any {
  const missing = result.missingFields || [];
  for (const field of missing) {
    if (!unanswerable.includes(field)) {
      return field;
    }
  }
  return null;
}

/**
 * Import coerceFactValue for fact validation.
 */
function coerceFactValue(key: any, value: any): any {
  const types = {
    age: (v: any) => (typeof v === 'number' && v >= 0 && v <= 150 ? v : undefined),
    annual_income: (v: any) => (typeof v === 'number' && v >= 0 ? v : undefined),
    state: (v: any) => (typeof v === 'string' && /^[A-Z]{2}$/.test(v) ? v : undefined),
    district: (v: any) => (typeof v === 'string' && v.length > 0 ? v : undefined),
    occupation: (v: any) => (['farmer', 'agricultural_laborer', 'daily_wage_worker', 'self_employed', 'salaried_private', 'government_employee', 'homemaker', 'student', 'unemployed', 'other'].includes(v as string) ? v : undefined),
    owns_house: (v: any) => (typeof v === 'boolean' ? v : undefined),
    marital_status: (v: any) => (['single', 'married', 'widowed', 'divorced_or_separated'].includes(v as string) ? v : undefined),
  };
  
  if (types[key as keyof typeof types]) {
    return types[key as keyof typeof types](value);
  }
  return undefined;
}

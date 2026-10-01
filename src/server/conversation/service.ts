/**
 * src/server/conversation/service.ts — Conversation state manager
 *
 * Manages conversation state, calls Gemini for extraction,
 * and coordinates with the deterministic eligibility engine.
 */

import { evaluateEligibility } from '@/src/server/engine/engine';
import type {
  ConversationState,
  ChatResponse,
} from './types';
import type { LanguageCode } from '@/src/types/language';
import { extractIntentAndFacts } from './bedrock';

// Load scheme from data file
import schemeData from '@/data/example-scheme.json';

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
      schemeId: schemeData.schemeId,
      currentStep: 'intent_discovery',
      facts: {},
      missingFields: [],
      lastEligibility: null,
      askedCount: {},
      unanswerableFields: [],
      scheme: schemeData as any,
      schemeVersion: schemeData.version,
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
    saveSession(sessionId, state);
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


    // LOGGING: Check if AWS_BEARER_TOKEN_BEDROCK is set
  // Try Gemini extraction if API key is configured
  try {
    if (process.env.AWS_BEARER_TOKEN_BEDROCK) {
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
    console.error('Bedrock extraction error:', error);
    // Continue with keyword extraction fallback
    const keywordResult = extractWithKeywords(message, state.schemeId, language);
    extractedFacts = keywordResult.extractedFacts;
    nextQuestion = keywordResult.nextQuestion;
    intent = keywordResult.intent;
  }

  // Merge extracted facts into state
  state = mergeFacts(state, extractedFacts);

  // Persist the updated state back to the session
  saveSession(sessionId, state);

  // Run eligibility engine
  const engineResult = evaluateEligibility(state.facts, state.scheme as any);

  // Check if all required facts are collected
  const allFieldsKnown = engineResult.missingFields.length === 0;

  // State machine based on currentStep
  if (state.currentStep === 'intent_discovery') {
    if (intent === 'find_scheme') {
      // Already have the scheme loaded, move to collecting_facts
      return startCollectingFacts(state, engineResult, language);
    } else if (intent === 'eligibility' || allFieldsKnown) {
      return startCollectingFacts(state, engineResult, language);
    } else if (intent === 'smalltalk') {
      return {
        response: responseText || (language === 'ta' ? 'சற்று நேரம் காத்திருங்கள்!' : 'Please wait a moment!'),
        state: { ...state, currentStep: 'intent_discovery' },
        status: 'needs_information',
      };
    } else {
      // Default: start collecting facts
      return startCollectingFacts(state, engineResult, language);
    }
  }

  if (state.currentStep === 'collecting_facts') {
    if (allFieldsKnown) {
      // All facts collected, show eligibility result
      state.currentStep = 'eligibility_result';
      state.lastEligibility = engineResult;
      return showEligibilityResult(state, engineResult, language);
    } else {
      // Still collecting facts - ask next question
      state.currentStep = 'collecting_facts';
      return askNextQuestion(state, engineResult, language);
    }
  }

  if (state.currentStep === 'eligibility_result') {
    if (intent === 'ask_documents') {
      state.currentStep = 'documents';
      return showDocuments(state, language);
    }
    if (intent === 'ask_how_to_apply') {
      state.currentStep = 'application_guidance';
      return showApplicationGuidance(state, language);
    }
    // If new info added, re-evaluate
    if (!allFieldsKnown) {
      return askNextQuestion(state, engineResult, language);
    }
    // Show result again
    return showEligibilityResult(state, engineResult, language);
  }

  if (state.currentStep === 'documents') {
    if (intent === 'ask_how_to_apply') {
      state.currentStep = 'application_guidance';
      return showApplicationGuidance(state, language);
    }
    return showDocuments(state, language);
  }

  if (state.currentStep === 'application_guidance') {
    return showApplicationGuidance(state, language);
  }

  if (state.currentStep === 'completed') {
    return {
      response: language === 'ta' ? 'மீண்டும் தொடங்க விரும்புகிறீர்களா?' : 'Would you like to start again?',
      state: { ...state, currentStep: 'intent_discovery' },
      status: 'needs_information',
    };
  }

  // Fallback
  return startCollectingFacts(state, engineResult, language);
}

/**
 * Start the facts collection phase.
 */
function startCollectingFacts(
  state: ConversationState,
  engineResult: any,
  language: LanguageCode
): ChatResponse {
  state.currentStep = 'collecting_facts';
  return askNextQuestion(state, engineResult, language);
}

/**
 * Ask the next missing question based on scheme's askOrder.
 */
function askNextQuestion(
  state: ConversationState,
  engineResult: any,
  language: LanguageCode
): ChatResponse {
  // Use scheme's askOrder to determine question order
  const askOrder = state.scheme?.eligibility.askOrder || ['state', 'age'];
  
  // Find first missing field in askOrder
  for (const field of askOrder) {
    if (!(field in state.facts) && !state.unanswerableFields.includes(field)) {
      // Ask this field
      const question = getQuestionForField(field, language);
      return {
        response: question,
        state: { ...state },
        status: 'needs_information',
        nextField: field,
      };
    }
  }

  // If no specific field to ask, try engine's missingFields
  if (engineResult.missingFields && engineResult.missingFields.length > 0) {
    for (const field of engineResult.missingFields) {
      if (!state.unanswerableFields.includes(field)) {
        const question = getQuestionForField(field, language);
        return {
          response: question,
          state: { ...state },
          status: 'needs_information',
          nextField: field,
        };
      }
    }
  }

  // Fallback generic message
  return {
    response: language === 'ta' 
      ? 'தயவுசெய்து உங்கள் விவரங்களை தயார் செய்துகொள்ளுங்கள், நாங்கள் உங்களுக்கான உதவித் திட்டத்தை தெரிவு செய்கிறோம்!'
      : 'Please prepare your details, we are selecting the right scheme for you!',
    state: { ...state },
    status: 'needs_information',
  };
}

/**
 * Generate a question for a specific field in the user's language.
 */
function getQuestionForField(field: string, language: LanguageCode): string {
  const questions: any = {
    state: {
      ta: 'நீங்கள் எந்த மாநிலத்தில் வாழ்கிறீர்கள்?',
      hi: 'आप किस राज्य में रहते हैं?',
      te: 'మీరు ఏ రాష్ట్రంలో నివసిస్తున్నారు?',
    },
    age: {
      ta: 'உங்கள் வயது என்ன?',
      hi: 'आपकी आयु क्या है?',
      te: 'మీ వయస్సు ఎంత?',
    },
    is_woman: {
      ta: 'நீங்கள் ஒரு பெண்ணாக இருக்கிறீர்களா?',
      hi: 'क्या आप एक महिला हैं?',
      te: 'మీరు మహిళ అవుతారా?',
    },
    annual_income: {
      ta: 'உங்கள் ஆண்டு வருமானம் என்ன?',
      hi: 'आपकी वार्षिक आय क्या है?',
      te: 'మీ సంవత్సర ఆదాయం ఎంత?',
    },
    owns_house: {
      ta: 'உங்களுக்கு ஒரு வீடு உறுதியாக உள்ளதா?',
      hi: 'क्या आपके पास एक स्थिर घर है?',
      te: 'మీకు ఒక స్థిరమైన ఇల్లు ఉందా?',
    },
    district: {
      ta: 'உங்கள் மாவட்டம் என்ன?',
      hi: 'आपका जिला क्या है?',
      te: 'మీ జిల్లా ఏది?',
    },
  };

  if (questions[field] && questions[field][language]) {
    return questions[field][language];
  }

  // Fallback generic question
  return language === 'ta'
    ? `உங்கள் ${field} என்ன?`
    : `What is your ${field}?`;
}

/**
 * Show eligibility result with scheme information.
 */
function showEligibilityResult(
  state: ConversationState,
  engineResult: any,
  language: LanguageCode
): ChatResponse {
  const schemeName = state.scheme?.localizedNames?.[language] || state.scheme?.name || 'Government Scheme';

  let response: string;
  if (engineResult.status === 'eligible') {
    response = language === 'ta'
      ? `அனைவருக்கும் வாழ்த்துகள்! 🎉\n\n${schemeName}\n\nநீங்கள் இந்த திட்டத்திற்கு அர்ஹத்தாக இருக்கிறீர்கள்! 🤩\n\nயோசனையின் பெரும் பயன்: ${state.scheme?.benefits?.[0]?.text}\n\nநீங்கள் கோரலாம்`
      : `Congratulations! 🎉\n\nYou are eligible for: ${schemeName}\n\nBig benefit: ${state.scheme?.benefits?.[0]?.text}\n\nYou can apply for this`;
  } else if (engineResult.status === 'not_eligible') {
    response = language === 'ta'
      ? `மன்னிக்கவும், ஆனால் இந்த திட்டத்திற்கு நீங்கள் அர்ஹத்தாக இல்லை. 😔\n\n${schemeName} திட்டத்தில் அர்ஹத்தாக இருப்பதற்கான முக்கிய தேவைகளை நீங்கள் பூரிக்கவில்லை.\n\nமற்ற தகுதிவாய்ந்த திட்டங்களைப் பற்றி அறிய நாங்கள் கவனமாக இருக்கலாம்!`
      : `Sorry, but you are not eligible for this scheme. 😔\n\nYou do not meet the main requirements for the ${schemeName} scheme.\n\nWe can help you find other eligible schemes!`;
  } else {
    response = language === 'ta'
      ? `நாங்கள் உங்களுக்கான தகுதியை தீர்மானிக்க தகவல்கள் கிடைக்கவில்லை. 😕\n\nமற்ற தகுதிவாய்ந்த திட்டங்களைப் பற்றி அறிய நாங்கள் கவனமாக இருக்கலாம்!`
      : `We lack the information to determine your eligibility. 😕\n\nWe can help you find other eligible schemes!`;
  }

  return {
    response,
    state: { ...state, currentStep: 'completed' },
    status: engineResult.status === 'eligible' ? 'eligible' : 'not_eligible',
    eligibilityResult: engineResult,
  };
}

/**
 * Show required documents.
 */
function showDocuments(state: ConversationState, language: LanguageCode): ChatResponse {
  const schemeName = state.scheme?.localizedNames?.[language] || state.scheme?.name || 'Scheme';

  let response = language === 'ta'
    ? `உங்கள் அர்ஹத்தான திட்டம்: ${schemeName}\n\nதாக்கல் செய்ய தேவையான ஆவணங்கள்:\n`
    : `Eligible scheme: ${schemeName}\n\nRequired documents:\n`;

  if (state.scheme?.requiredDocuments && state.scheme.requiredDocuments.length > 0) {
    state.scheme.requiredDocuments.forEach((doc: any, index: number) => {
      response += `\n${index + 1}. ${doc.name}\n`;
      if (doc.description) {
        response += `   ${doc.description}\n`;
      }
    });
  } else {
    response += language === 'ta' 
      ? 'அதிகாரப்பூர்வ அதிகாரியிடம் கேளுங்கள்.'
      : 'Ask the official for details.';
  }

  return {
    response,
    state: { ...state, currentStep: 'documents' },
    status: 'needs_information',
  };
}

/**
 * Show application guidance with steps.
 */
function showApplicationGuidance(state: ConversationState, language: LanguageCode): ChatResponse {
  const schemeName = state.scheme?.localizedNames?.[language] || state.scheme?.name || 'Scheme';
  const officialUrl = state.scheme?.officialApplicationUrl || '';

  let response = language === 'ta'
    ? `${schemeName} திட்டத்திற்கு விண்ணப்பிப்பது எப்படி?\n\n`
    : `How to apply for ${schemeName}?\n\n`;

  if (state.scheme?.applicationSteps && state.scheme.applicationSteps.length > 0) {
    state.scheme.applicationSteps.forEach((step: any, index: number) => {
      response += `${index + 1}. ${step.text}\n`;
    });
  }

  if (officialUrl) {
    response += `\nஅதிகாரப்பூர்வ வலைத்தளம்: ${officialUrl}`;
  }

  if (state.scheme?.helplines && state.scheme.helplines.length > 0) {
    const helpline = state.scheme.helplines[0];
    response += `\n\nஅவசர உதவி தொடர்பு: ${helpline.name} - ${helpline.number}`;
  }

  return {
    response,
    state: { ...state, currentStep: 'application_guidance' },
    status: 'needs_information',
  };
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
 * Import coerceFactValue for fact validation.
 */
function coerceFactValue(key: any, value: any): any {
  const types: Record<string, (v: any) => any> = {
    age: (v: any) => (typeof v === 'number' && v >= 0 && v <= 150 ? v : undefined),
    annual_income: (v: any) => (typeof v === 'number' && v >= 0 ? v : undefined),
    state: (v: any) => (typeof v === 'string' && /^[A-Z]{2}$/.test(v) ? v : undefined),
    district: (v: any) => (typeof v === 'string' && v.length > 0 ? v : undefined),
    occupation: (v: any) => (['farmer', 'agricultural_laborer', 'daily_wage_worker', 'self_employed', 'salaried_private', 'government_employee', 'homemaker', 'student', 'unemployed', 'other'].includes(v as string) ? v : undefined),
    owns_house: (v: any) => (typeof v === 'boolean' ? v : undefined),
    marital_status: (v: any) => (['single', 'married', 'widowed', 'divorced_or_separated'].includes(v as string) ? v : undefined),
    is_woman: (v: any) => {
      if (typeof v === 'boolean') return v;
      if (typeof v === 'string') {
        const val = v.toLowerCase();
        if (val.includes('yes') || val.includes('ஆம்') || val.includes('ஆகும்')) return true;
        if (val.includes('no') || val.includes('இல்லை')) return false;
      }
      return undefined;
    },
  };

  if (types[key as keyof typeof types]) {
    return types[key as keyof typeof types](value);
  }
  return undefined;
}

// Exported for testing
export function extractWithKeywords(message: string, currentSchemeId: string | null, language: LanguageCode) {
  const msgLower = message.toLowerCase();
  const facts: Record<string, any> = {};

  // Tamil keywords
  if (msgLower.includes('ஆம்') || msgLower.includes('ஆகும்')) facts.is_woman = true;
  if (msgLower.includes('இல்லை')) {
    if (msgLower.includes('பெண்')) facts.is_woman = false;
  }

  // age
  const ageMatch = message.match(/(\d{1,3})\s*(வயது|வயது|வயது|-years?|years?)/i);
  if (ageMatch && ageMatch[1]) {
    facts.age = parseInt(ageMatch[1], 10);
  }

  // state - Tamil Nadu
  if (msgLower.includes('தமிழ்நாடு') || msgLower.includes('tamil nadu') || msgLower.includes('tamil nad') || msgLower.includes('tamil')) {
    facts.state = 'TN';
  }
  // Other states
  const stateNames: Record<string, string> = {
    'andhra': 'AP', 'telangana': 'TS', 'karnataka': 'KA', 'kerala': 'KL',
    'maharashtra': 'MH', 'gujarat': 'GJ', 'delhi': 'DL', 'uttar': 'UP',
    'west bengal': 'WB', 'bihar': 'BR', 'odisha': 'OR', 'chhattisgarh': 'CT',
    'haryana': 'HR', 'himachal': 'HP', 'punjab': 'PB', 'rajasthan': 'RJ',
  };
  for (const [key, val] of Object.entries(stateNames)) {
    if (msgLower.includes(key)) {
      facts.state = val;
      break;
    }
  }

  // annual_income - Tamil keywords for income/salary/daily wage
  if (msgLower.includes('வருமானம்') || msgLower.includes('சம்பளம்') || msgLower.includes('வருமானம்')) {
    const incomeMatch = message.match(/(\d{1,10})/);
    if (incomeMatch && incomeMatch[1]) {
      facts.annual_income = parseInt(incomeMatch[1], 10);
    }
  }

  // owns_house
  if (msgLower.includes('இல்லை') || msgLower.includes('dont') || msgLower.includes('no house')) {
    facts.owns_house = false;
  }

  // marital_status
  if (msgLower.includes('விதிவிலக்கு') || msgLower.includes('widow')) {
    facts.marital_status = 'widowed';
  }

  // Determine intent
  let intent: string = 'eligibility';

  // Check for women's assistance request
  if (msgLower.includes('பெண்குக்கான') || msgLower.includes('பெண்களுக்கான') || msgLower.includes('பெண் திட்ட') || msgLower.includes('women') || msgLower.includes('பெண் உதவி')) {
    if (currentSchemeId) {
      intent = 'eligibility';
    } else {
      intent = 'find_scheme';
    }
  }

  // Check for documents or application help
  if (msgLower.includes('ஆவணம்') || msgLower.includes('documents') || msgLower.includes('தாக்கல்')) {
    intent = 'ask_documents';
  }
  if (msgLower.includes('விண்ணப்பிப்பது') || msgLower.includes('how to apply') || msgLower.includes('application')) {
    intent = 'ask_how_to_apply';
  }

  return { extractedFacts: facts, nextQuestion: '', intent };
}

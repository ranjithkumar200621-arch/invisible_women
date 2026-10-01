/**
 * src/server/conversation/gemini.ts — Gemini LLM service
 *
 * Handles structured extraction and composition.
 * Gemini NEVER determines eligibility - only extracts facts and intent.
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

/**
 * Gemini model for structured extraction (JSON mode).
 */
const EXTRACT_MODEL = 'gemini-1.5-flash';

/**
 * Gemini model for composition (text generation).
 */
const COMPOSE_MODEL = 'gemini-1.5-flash';

/**
 * Schema for Gemini structured extraction ResponseFormat.
 */
const EXTRACT_SCHEMA = {
  title: 'UserIntentExtraction',
  description: 'Extract user intent, facts, and missing information from conversation',
  type: 'object',
  properties: {
    intent: {
      type: 'string',
      enum: [
        'find_scheme',
        'eligibility',
        'smalltalk',
        'restart',
        'repeat_last',
        'correct_info',
        'ask_benefits',
        'ask_documents',
        'ask_how_to_apply',
        'unsupported_request'
      ],
      description: 'The user\'s primary intent'
    },
    extracted_facts: {
      type: 'object',
      description: 'Extracted facts from the user\'s utterance',
      properties: {
        age: { type: 'number', description: 'User\'s age in years' },
        annual_income: { type: 'number', description: 'Annual household income in INR' },
        state: { type: 'string', description: 'Indian state code (2-letter code like TN, KA, etc.)' },
        district: { type: 'string', description: 'District name' },
        occupation: {
          type: 'string',
          enum: [
            'farmer',
            'agricultural_laborer',
            'daily_wage_worker',
            'self_employed',
            'salaried_private',
            'government_employee',
            'homemaker',
            'student',
            'unemployed',
            'other'
          ],
          description: 'User\'s occupation'
        },
        owns_house: { type: 'boolean', description: 'Does the household own a house?' },
        marital_status: {
          type: 'string',
          enum: ['single', 'married', 'widowed', 'divorced_or_separated'],
          description: 'Marital status'
        }
      },
      additionalProperties: false,
      required: []
    },
    missing_fields: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['age', 'annual_income', 'state', 'district', 'occupation', 'owns_house', 'marital_status']
      },
      description: 'Fields that are still needed but not provided in this message'
    },
    confidence: {
      type: 'string',
      enum: ['high', 'medium', 'low'],
      description: 'Confidence in the extraction'
    },
    matched_scheme_id: {
      type: 'string',
      nullable: true,
      description: 'Scheme ID if user asked for a specific scheme'
    },
    next_question: {
      type: 'string',
      description: 'Next question to ask the user (in user\'s language)'
    },
    response: {
      type: 'string',
      description: 'User-facing response text'
    },
    unintelligible: {
      type: 'boolean',
      description: 'True if the utterance was empty/noise/unintelligible'
    }
  },
  required: ['intent', 'extracted_facts', 'missing_fields', 'confidence', 'unintelligible']
};

export interface GeminiExtractedData {
  intent: 'find_scheme' | 'eligibility' | 'smalltalk' | 'restart' | 'repeat_last' | 'correct_info' | 'ask_benefits' | 'ask_documents' | 'ask_how_to_apply' | 'unsupported_request';
  extractedFacts: Record<string, any>;
  missingFields: string[];
  confidence: 'high' | 'medium' | 'low';
  matchedSchemeId?: string;
  nextQuestion: string;
  response: string;
  unintelligible: boolean;
}

/**
 * Call Gemini with structured output for fact/intent extraction.
 */
export async function extractIntentAndFacts(
  utterance: string,
  language: string,
  currentSchemeId?: string
): Promise<GeminiExtractedData> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is required');
  }

  // Construct the prompt
  const prompt = `You are a helpful assistant for a government scheme eligibility chatbot.

Extract intent and facts from the user's message.
Return a JSON object matching this schema:
{
  "intent": "find_scheme" | "eligibility" | "smalltalk" | "restart" | "repeat_last" | "correct_info" | "ask_benefits" | "ask_documents" | "ask_how_to_apply" | "unsupported_request",
  "extracted_facts": {
    "age": number | null,
    "annual_income": number | null,
    "state": string | null,
    "district": string | null,
    "occupation": "farmer" | "agricultural_laborer" | "daily_wage_worker" | "self_employed" | "salaried_private" | "government_employee" | "homemaker" | "student" | "unemployed" | "other" | null,
    "owns_house": boolean | null,
    "marital_status": "single" | "married" | "widowed" | "divorced_or_separated" | null
  },
  "missing_fields": ["age", "annual_income", "state", "district", "occupation", "owns_house", "marital_status"],
  "confidence": "high" | "medium" | "low",
  "matched_scheme_id": string | null,
  "next_question": "string",
  "response": "string",
  "unintelligible": boolean
}

User message (in ${language}): "${utterance}"
Current scheme: ${currentSchemeId || 'not yet selected'}

IMPORTANT: Return ONLY valid JSON, no additional text.`;

  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + GEMINI_API_KEY, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          responseModalities: ['TEXT'],
          responseMimeType: 'application/json',
          responseSchema: EXTRACT_SCHEMA,
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Parse and validate the JSON response
    let result: any;
    try {
      result = JSON.parse(text);
    } catch (e) {
      console.error('Failed to parse Gemini response:', text);
      throw new Error('Invalid Gemini extraction format');
    }

    // Validate required fields
    if (!result.intent || !result.extracted_facts || !result.missing_fields || typeof result.unintelligible !== 'boolean') {
      throw new Error('Missing required fields in Gemini response');
    }

    // Normalize state codes
    if (result.extracted_facts.state && typeof result.extracted_facts.state === 'string') {
      result.extracted_facts.state = result.extracted_facts.state.toUpperCase();
    }

    return {
      intent: result.intent,
      extractedFacts: result.extracted_facts,
      missingFields: result.missing_fields || [],
      confidence: result.confidence as 'high' | 'medium' | 'low',
      matchedSchemeId: result.matched_scheme_id || undefined,
      nextQuestion: result.next_question || '',
      response: result.response || '',
      unintelligible: result.unintelligible || false
    };
  } catch (error) {
    console.error('Gemini extraction error:', error);
    throw error;
  }
}

/**
 * Compose a question for asking a specific field.
 */
export async function composeQuestion(
  language: string,
  fieldName: string,
  attempt: number
): Promise<string> {
  if (!GEMINI_API_KEY) {
    // Fallback if Gemini is not configured
    const prompts: Record<string, Record<string, string>> = {
      en: {
        state: 'Which state do you live in?',
        age: 'How old are you?',
        owns_house: 'Do you own a house?',
        annual_income: 'What is your annual household income?',
        marital_status: 'What is your marital status?',
        occupation: 'What is your occupation?',
        district: 'Which district do you live in?',
      },
      ta: {
        state: 'நீங்கள் எந்த மாநிலத்தில் வாழ்கிறீர்கள்?',
        age: 'உங்களுக்கு எத்தனை வயது?',
        owns_house: 'உங்களுக்கு ஒரு வீடு உள்ளதா?',
        annual_income: 'உங்கள் ஆண்டு வருமானம் எவ்வளவு?',
        marital_status: 'உங்கள் திருமண நிலை என்ன?',
        occupation: 'உங்கள் தொழில் என்ன?',
        district: 'நீங்கள் எந்த மாவட்டத்தில் வாழ்கிறீர்கள்?',
      },
    };
    return prompts[language]?.[fieldName] || prompts['en'][fieldName] || `What is your ${fieldName}?`;
  }

  const prompt = `Create a simple question to ask the user for: ${ fieldName }

Requirements:
- Simple, conversational ${language} question
- Keep it under 15 words

Return ONLY the question text.`;

  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + GEMINI_API_KEY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7 }
      })
    });

    if (!response.ok) {
      throw new Error('Gemini composition failed');
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || `What is your ${fieldName}?`;
  } catch (error) {
    console.error('Gemini composition error:', error);
    const prompts: Record<string, Record<string, string>> = {
      en: { state: 'Which state do you live in?', age: 'How old are you?', owns_house: 'Do you own a house?', annual_income: 'What is your annual household income?', marital_status: 'What is your marital status?', occupation: 'What is your occupation?', district: 'Which district do you live in?' },
      ta: { state: 'நீங்கள் எந்த மாநிலத்தில் வாழ்கிறீர்கள்?', age: 'உங்களுக்கு எத்தனை வயது?', owns_house: 'உங்களுக்கு ஒரு வீடு உள்ளதா?', annual_income: 'உங்கள் ஆண்டு வருமானம் எவ்வளவு?', marital_status: 'உங்கள் திருமண நிலை என்ன?', occupation: 'உங்கள் தொழில் என்ன?', district: 'நீங்கள் எந்த மாவட்டத்தில் வாழ்கிறீர்கள்?' },
    };
    return prompts[language]?.[fieldName] || prompts['en'][fieldName] || `What is your ${fieldName}?`;
  }
}

/**
 * Compose a response based on plan.
 */
export async function composeResponse(
  language: string,
  englishText: string,
  context: Record<string, any>
): Promise<string> {
  if (!GEMINI_API_KEY) {
    return englishText;
  }

  const prompt = `Translate and simplify this message for ${language} interface:

"${englishText}"

Requirements:
- Keep it simple and conversational
- Use ${language} script
- Do not add any new information
- Keep it under 20 words

Return ONLY the translated text.`;

  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + GEMINI_API_KEY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7 }
      })
    });

    if (!response.ok) {
      throw new Error('Gemini composition failed');
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || englishText;
  } catch (error) {
    console.error('Gemini composition error:', error);
    return englishText;
  }
}

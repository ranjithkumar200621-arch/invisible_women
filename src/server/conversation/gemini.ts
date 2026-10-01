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
const EXTRACT_MODEL = 'gemini-3.8-flash';

/**
 * Gemini model for composition (text generation).
 */
const COMPOSE_MODEL = 'gemini-3.8-flash';

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
      description: "The user's primary intent"
    },
    extracted_facts: {
      type: 'object',
      description: 'Extracted facts from the user utterance',
      properties: {
        age: { type: 'number', description: "User's age in years" },
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
          description: "User's occupation"
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
      description: 'Next question to ask the user (in user\'s language). Keep it simple and ask ONE question at a time.'
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

  // Get scheme details for context
  const schemeContext = currentSchemeId
    ? `Current scheme: ${currentSchemeId}. Guide the user toward demonstrating eligibility for this scheme.`
    : 'You are helping users find and check eligibility for government schemes. The available scheme is a housing assistance program for low-income households. Focus on gathering information that helps determine eligibility.';

  // Construct the prompt with better guidance
  const prompt = `You are a helpful assistant for a government scheme eligibility chatbot in ${language}.

  The available government scheme is a HOUSING ASSISTANCE program for low-income households. It provides financial help for housing needs to eligible families.

  Extract intent and facts from the user's message.
  
  IMPORTANT GUIDANCE:
  1. If user asks for "women's scheme" or similar, understand they want to know about schemes they might qualify for
  2. The current scheme is HOUSING ASSISTANCE - guide users toward this scheme
  3. Ask ONE question at a time (age, income, state, etc.)
  4. If user seems confused about which scheme, explain briefly that we help with housing assistance
  5. Keep responses simple, supportive, and in the user's language (Tamil, Hindi, or English)
  
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
  ${schemeContext}

  IMPORTANT: Return ONLY valid JSON, no additional text.`;

  try {
    const response = await fetch('https://generativelanguages.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=' + GEMINI_API_KEY, {
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
      console.error('Gemini extraction error:', errorText);
      throw new Error(`Gemini extraction failed: ${response.status}`);
    }

    const data = await response.json();
    
    // Parse the JSON response
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Clean up potential markdown formatting
    let jsonStr = content.trim();
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.replace('```json', '').replace('```', '').trim();
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace('```', '').trim();
    }
    
    const parsed = JSON.parse(jsonStr);

    return {
      intent: parsed.intent || 'unsupported_request',
      extractedFacts: parsed.extracted_facts || {},
      missingFields: parsed.missing_fields || [],
      confidence: parsed.confidence || 'medium',
      matchedSchemeId: parsed.matched_scheme_id || undefined,
      nextQuestion: parsed.next_question || '',
      response: parsed.response || '',
      unintelligible: parsed.unintelligible || false
    };
  } catch (error) {
    console.error('Gemini extraction error:', error);
    throw error;
  }
}

/**
 * Compose a response using Gemini (fallback if direct composition is needed).
 */
export async function composeResponse(
  context: {
    intent: string;
    facts: Record<string, any>;
    missingFields: string[];
    response: string;
  },
  language: string
): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is required');
  }

  const prompt = `Compose a helpful, supportive response in ${language} for a government scheme eligibility chatbot.

  Context:
  - User intent: ${context.intent}
  - Facts extracted: ${JSON.stringify(context.facts)}
  - Missing fields: ${context.missingFields.join(', ')}
  - Previous response: ${context.response}

  Keep the response:
  - Simple and supportive
  - In the user's language (${language})
  - Focused on eligibility for government assistance

  Return ONLY the response text, no JSON.`;

  try {
    const response = await fetch('https://generativelanguages.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=' + GEMINI_API_KEY, {
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
          temperature: 0.7,
        }
      })
    });

    if (!response.ok) {
      throw new Error('Composition failed');
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || context.response;
  } catch (error) {
    console.error('Composition error:', error);
    // Return the original response if composition fails
    return context.response;
  }
}

/**
 * src/server/conversation/bedrock.ts — AWS Bedrock Qwen3 32B integration
 *
 * Handles structured extraction and composition using AWS Bedrock.
 * Bedrock NEVER determines eligibility - only extracts facts and intent.
 */

const AWS_BEARER_TOKEN_BEDROCK = process.env.AWS_BEARER_TOKEN_BEDROCK || '';
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

/**
 * Bedrock model ID for structured extraction.
 * Uses the model from environment variable.
 */
const BEDROCK_MODEL_ID = process.env.BEDROCK_MODEL_ID || 'qwen.qwen3-32b-v1:0';

/**
 * Schema for structured extraction - matches Gemini format for compatibility.
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
        },
        is_woman: { type: 'boolean', description: 'Is the applicant a woman?' }
      },
      additionalProperties: false,
      required: []
    },
    missing_fields: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['age', 'annual_income', 'state', 'district', 'occupation', 'owns_house', 'marital_status', 'is_woman']
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

/**
 * Build the system prompt for Bedrock.
 */
function buildSystemPrompt(): string {
  return `You are a helpful government scheme eligibility assistant. Your task is to extract user intent, facts, and identify what information is missing.

IMPORTANT RULES:
- You NEVER determine eligibility - only extract facts and identify missing information
- Ask only ONE question at a time
- Keep responses simple and supportive
- In Tamil: Use simple Tamil without technical terminology
- In Hindi/English: Keep responses clear and direct
- Always include intent, extracted_facts, missing_fields, confidence, next_question, response, and unintelligible in your response
- Extract facts exactly as provided by the user
- If user did not provide a fact, include it in missing_fields
- Set confidence based on how clearly the user provided information
- Set unintelligible to true only if the message was empty, noise, or completely unclear

Current scheme: Kalaignar Magalir Urimai Thogai (women's welfare scheme in Tamil Nadu)
Required fields: state, age, is_woman, annual_income`;
}

/**
 * Build the user message prompt.
 */
function buildUserPrompt(message: string, language: string, schemeId?: string): string {
  const schemeContext = schemeId ? `Current scheme: ${schemeId}` : '';
  
  return `${schemeContext}

User message in ${language}:
"${message}"

Please extract:
1. intent - what does the user want to do?
2. extracted_facts - what facts can you determine from this message?
3. missing_fields - what information is still needed?
4. confidence - how confident are you in the extraction?
5. next_question - what should we ask next?
6. response - a brief response to the user
7. unintelligible - was the message unclear?

Return ONLY valid JSON.`;
}

/**
 * Extract intent and facts using AWS Bedrock Qwen3 32B.
 */

export async function extractIntentAndFacts(
  message: string,
  language: string,
  schemeId?: string
): Promise<{
  intent: string;
  extractedFacts: Record<string, any>;
  missingFields: string[];
  confidence: 'high' | 'medium' | 'low';
  matchedSchemeId?: string;
  nextQuestion: string;
  response: string;
  unintelligible: boolean;
}> {
  if (!AWS_BEARER_TOKEN_BEDROCK) {
    throw new Error('AWS_BEARER_TOKEN_BEDROCK environment variable is required');
  }

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(message, language, schemeId);

  try {
    // Build the Bedrock Converse API request
    const response = await fetch(`https://bedrock-runtime.${AWS_REGION}.amazonaws.com/model/${BEDROCK_MODEL_ID}/converse`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AWS_BEARER_TOKEN_BEDROCK}`,
        'Content-Type': 'application/json',
        'X-Amz-Content-Sha256': 'required'
      },
      body: JSON.stringify({
        system: [{ text: systemPrompt }],
        messages: [{ role: 'user', content: [{ text: userPrompt }] }],
        inferenceConfig: {
          temperature: 0.1,
          maxTokens: 2048
        },
        additionalModelRequestFields: {
          response_format: {
            type: 'json_object',
            schema: EXTRACT_SCHEMA
          }
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Bedrock extraction error:', errorText);
      throw new Error(`Bedrock extraction failed: ${response.status}`);
    }

    const data = await response.json();
    
    // Parse the response content
    const content = data.output?.message?.content?.[0]?.text || '';
    
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
    console.error('Bedrock extraction error:', error);
    throw error;
  }
}

/**
 * Compose a response using Bedrock (fallback if direct composition is needed).
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
  if (!AWS_BEARER_TOKEN_BEDROCK) {
    throw new Error('AWS_BEARER_TOKEN_BEDROCK environment variable is required');
  }

  const systemPrompt = `You are a helpful government scheme eligibility assistant. Compose a clear, supportive response in ${language} that:
1. Explains eligibility status clearly
2. Lists required documents if needed
3. Explains next steps
4. Uses simple language a first-time user would understand
5. Avoids technical jargon
6. In Tamil: Use simple Tamil, avoid English unless necessary`;

  const userPrompt = `Compose a response in ${language}:

Context:
- User intent: ${context.intent}
- Facts extracted: ${JSON.stringify(context.facts)}
- Missing fields: ${context.missingFields.join(', ')}
- Current response: ${context.response}

Keep the response:
- Simple and supportive
- In the user's language (${language})
- Focused on eligibility for government assistance
- No JSON, just plain text response

Return ONLY the response text.`;

  try {
    const response = await fetch(`https://bedrock-runtime.${AWS_REGION}.amazonaws.com/model/${BEDROCK_MODEL_ID}/converse`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AWS_BEARER_TOKEN_BEDROCK}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        system: [{ text: systemPrompt }],
        messages: [{ role: 'user', content: [{ text: userPrompt }] }],
        inferenceConfig: {
          temperature: 0.7,
          maxTokens: 1024
        }
      })
    });

    if (!response.ok) {
      throw new Error('Bedrock composition failed');
    }

    const data = await response.json();
    return data.output?.message?.content?.[0]?.text || context.response;
  } catch (error) {
    console.error('Bedrock composition error:', error);
    // Return the original response if composition fails
    return context.response;
  }
}

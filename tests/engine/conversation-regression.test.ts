/**
 * Regression tests for conversation flow with Tamil input
 * Tests the fallback keyword extraction path (when GEMINI_API_KEY is not set)
 */

import { describe, it, expect } from 'vitest';
import { extractWithKeywords } from '@/src/server/conversation/service';

describe('Conversation Flow - Tamil Input Tests (Fallback Path)', () => {
  const userMessage = "எனக்கு பெண்களுக்கான அரசு உதவித் திட்டம் வேண்டும்.";
  
  it('should NOT return "which scheme" question for women assistance request', () => {
    const result = extractWithKeywords(userMessage, null, 'ta');
    
    // The response should NOT be the "which scheme" question
    const isSchemeClarification = result.nextQuestion.includes('எந்த திட்டத்தைப் பற்றி') || 
                                   result.nextQuestion.includes('Which scheme');
    
    expect(isSchemeClarification).toBe(false);
  });
  
  it('should handle women assistance request properly', () => {
    const result = extractWithKeywords(userMessage, null, 'ta');
    
    // The intent should be find_scheme (they want to find a scheme)
    // but the nextQuestion should NOT be "which scheme" - it should guide them
    expect(result.intent).toBeOneOf(['find_scheme', 'eligibility']);
  });
});


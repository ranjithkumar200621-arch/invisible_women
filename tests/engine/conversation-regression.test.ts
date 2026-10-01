/**
 * Regression tests for conversation flow with Tamil input
 * Tests the fallback keyword extraction path (when GEMINI_API_KEY is not set)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { extractWithKeywords, processMessage, loadSession } from '@/src/server/conversation/service';

describe('Conversation Flow - Tamil Input Tests (Fallback Path)', () => {
  const userMessage = "எனக்கு பெண்களுக்கான அரசு உதவித் திட்டம் வேண்டும்.";
  
  it('should NOT return "which scheme" question for women assistance request', () => {
    const result = extractWithKeywords(userMessage, null, 'ta');
    
    const isSchemeClarification = result.nextQuestion.includes('எந்த திட்டத்தைப் பற்றி') || 
                                   result.nextQuestion.includes('Which scheme');
    
    expect(isSchemeClarification).toBe(false);
  });
  
  it('should handle women assistance request properly', () => {
    const result = extractWithKeywords(userMessage, null, 'ta');
    
    expect(result.intent).toBeOneOf(['find_scheme', 'eligibility']);
  });
});

/**
 * Regression test for session state persistence bug
 * 
 * Bug: The app was not retaining conversation facts between turns.
 * User says "Tamil Nadu", then provides age, but the state was reset.
 * 
 * Expected: state "TN" should remain after age is provided.
 */
describe('Session State Persistence Regression Test', () => {
  it('should retain state facts across multiple turns - Tamil input', async () => {
    const sessionId = 'test-session-persistence-tamil-' + Date.now();
    
    // Turn 1: User provides state in Tamil
    const turn1 = await processMessage(sessionId, 'தமிழ்நாடு', 'ta');
    
    // Load the session to check if state was persisted
    const session1 = loadSession(sessionId);
    
    // Check that state was extracted and persisted
    expect(session1.facts.state).toBe('TN');
    
    // Turn 2: User provides age in Tamil with "வயது"
    const turn2 = await processMessage(sessionId, '20 வயது', 'ta');
    
    // Load the session again to verify both facts are present
    const session2 = loadSession(sessionId);
    
    // Both facts should be present
    expect(session2.facts.state).toBe('TN');
    expect(session2.facts.age).toBe(20);
  });
  
  it('should retain state facts across multiple turns - English input', async () => {
    const sessionId = 'test-session-persistence-eng-' + Date.now();
    
    // Turn 1: User provides state
    const turn1 = await processMessage(sessionId, 'Tamil Nadu', 'ta');
    
    const session1 = loadSession(sessionId);
    expect(session1.facts.state).toBe('TN');
    
    // Turn 2: User provides age (without years - keyword extraction will need to handle this)
    // Using "20 years" format for keyword matching
    const turn2 = await processMessage(sessionId, '20 years', 'ta');
    
    const session2 = loadSession(sessionId);
    
    expect(session2.facts.state).toBe('TN');
    // Age might not be extracted without "years" suffix - that's a known limitation
    expect(session2.facts.age).toBe(20);
  });
  
  it('should not reuse facts from another session', async () => {
    const sessionId1 = 'test-session-a-' + Date.now();
    const sessionId2 = 'test-session-b-' + Date.now();
    
    // Process a message for session 1
    await processMessage(sessionId1, 'தமிழ்நாடு', 'ta');
    
    const session1 = loadSession(sessionId1);
    const session2 = loadSession(sessionId2);
    
    // Session 2 should not have session 1's facts
    expect(session1.facts.state).toBe('TN');
    expect(session2.facts.state).toBeUndefined();
  });
});

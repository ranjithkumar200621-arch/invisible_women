/**
 * tests/engine/engine.test.ts — Unit tests for the eligibility engine
 *
 * Tests verify structured eligibility results, not conversational logic.
 */

import { describe, it, expect } from 'vitest';
import { evaluateEligibility } from '@/src/server/engine/engine';
import type { FactMap } from '@/src/types/eligibility';
import { EXAMPLE_SCHEME } from './fixtures';

describe('Eligibility Engine', () => {
  describe('eligible user tests', () => {
    it('should return eligible when all criteria are met', () => {
      const userFacts: FactMap = {
        age: 25,
        gender: 'female' as const,
        state: 'TN' as const,
        owns_house: false,
        annual_income: 100000,
        marital_status: 'single' as const,
        occupation: 'homemaker' as const,
      };

      const result = evaluateEligibility(userFacts, EXAMPLE_SCHEME);

      expect(result.status).toBe('eligible');
      expect(result.matchedRules.length).toBeGreaterThan(0);
    });

    it('should return eligible when priority marital status is met (even with high income)', () => {
      const userFacts: FactMap = {
        age: 22,
        gender: 'female' as const,
        state: 'TN' as const,
        owns_house: false,
        annual_income: 200000,
        marital_status: 'widowed' as const,
        occupation: 'homemaker' as const,
      };

      const result = evaluateEligibility(userFacts, EXAMPLE_SCHEME);

      expect(result.status).toBe('eligible');
      expect(result.missingFields.length).toBe(0);
    });
  });

  describe('age failure tests', () => {
    it('should return not_eligible when age is below minimum (18)', () => {
      const userFacts: FactMap = {
        age: 16,
        gender: 'female' as const,
        state: 'TN' as const,
        owns_house: false,
        annual_income: 200000,
        marital_status: 'single' as const,
        occupation: 'student' as const,
      };

      const result = evaluateEligibility(userFacts, EXAMPLE_SCHEME);

      expect(result.status).toBe('not_eligible');
      expect(result.missingFields.length).toBe(0);
      const ageFailure = result.failedRules.find(
        (r) => r.reasonCode === 'AGE_BELOW_MINIMUM',
      );
      expect(ageFailure).toBeDefined();
    });

    it('should return not_eligible when age is very high (>120)', () => {
      const userFacts: FactMap = {
        age: 150,
        gender: 'female' as const,
        state: 'TN' as const,
        owns_house: false,
        annual_income: 200000,
        marital_status: 'single' as const,
        occupation: 'homemaker' as const,
      };

      const result = evaluateEligibility(userFacts, EXAMPLE_SCHEME);

      expect(result.status).toBe('not_eligible');
      expect(result.missingFields.length).toBe(0);
    });
  });

  describe('income failure tests', () => {
    it('should return not_eligible when income exceeds 300000', () => {
      const userFacts: FactMap = {
        age: 35,
        gender: 'female' as const,
        state: 'TN' as const,
        owns_house: false,
        annual_income: 500000,
        marital_status: 'single' as const,
        occupation: 'homemaker' as const,
      };

      const result = evaluateEligibility(userFacts, EXAMPLE_SCHEME);

      expect(result.status).toBe('not_eligible');
      expect(result.missingFields.length).toBe(0);
      const incomeFailure = result.failedRules.find(
        (r) => r.reasonCode === 'INCOME_ABOVE_LIMIT',
      );
      expect(incomeFailure).toBeDefined();
    });

    it('should return not_eligible when income exceeds priority limit (120000)', () => {
      const userFacts: FactMap = {
        age: 40,
        gender: 'female' as const,
        state: 'TN' as const,
        owns_house: false,
        annual_income: 200000,
        marital_status: 'single' as const,
        occupation: 'homemaker' as const,
      };

      const result = evaluateEligibility(userFacts, EXAMPLE_SCHEME);

      expect(result.status).toBe('not_eligible');
      expect(result.missingFields.length).toBe(0);
      const priorityFailure = result.failedRules.find(
        (r) => r.reasonCode === 'INCOME_ABOVE_PRIORITY_LIMIT',
      );
      expect(priorityFailure).toBeDefined();
    });
  });

  describe('state failure tests', () => {
    it('should return not_eligible when not in Tamil Nadu', () => {
      const userFacts: FactMap = {
        age: 30,
        gender: 'female' as const,
        state: 'KA' as const,
        owns_house: false,
        annual_income: 200000,
        marital_status: 'single' as const,
        occupation: 'homemaker' as const,
      };

      const result = evaluateEligibility(userFacts, EXAMPLE_SCHEME);

      expect(result.status).toBe('not_eligible');
      expect(result.missingFields.length).toBe(0);
      const stateFailure = result.failedRules.find(
        (r) => r.reasonCode === 'STATE_NOT_COVERED',
      );
      expect(stateFailure).toBeDefined();
    });
  });

  describe('multiple failures tests', () => {
    it('should return all failures when multiple criteria fail', () => {
      const userFacts: FactMap = {
        age: 15,
        gender: 'female' as const,
        state: 'KA' as const,
        owns_house: true,
        annual_income: 500000,
        marital_status: 'single' as const,
        occupation: 'homemaker' as const,
      };

      const result = evaluateEligibility(userFacts, EXAMPLE_SCHEME);

      expect(result.status).toBe('not_eligible');
      expect(result.missingFields.length).toBe(0);
      
      const failureCodes = result.failedRules.map((r) => r.reasonCode);
      expect(failureCodes).toContain('AGE_BELOW_MINIMUM');
      expect(failureCodes).toContain('STATE_NOT_COVERED');
      expect(failureCodes).toContain('ALREADY_OWNS_HOUSE');
      expect(failureCodes).toContain('INCOME_ABOVE_LIMIT');
    });

    it('should return not_eligible for government employee exclusion', () => {
      const userFacts: FactMap = {
        age: 30,
        gender: 'female' as const,
        state: 'TN' as const,
        owns_house: false,
        annual_income: 100000,
        marital_status: 'widowed' as const,
        occupation: 'government_employee' as const,
      };

      const result = evaluateEligibility(userFacts, EXAMPLE_SCHEME);

      // User should NOT be eligible because they're a government employee
      expect(result.status).toBe('not_eligible');
      expect(result.missingFields.length).toBe(0);
      
      // Check that the user is a government employee by verifying
      // that R_EXCLUDE_GOVT rule evaluated to true (matches government_employee)
      const govRule = result.matchedRules.find(
        (r) => r.ruleId === 'R_EXCLUDE_GOVT',
      );
      expect(govRule).toBeDefined();
      expect(govRule?.reasonCode).toBe('EXCLUDED_GOVERNMENT_EMPLOYEE');
    });
  });

  describe('missing information tests', () => {
    it('should return undetermined when key facts are missing', () => {
      const userFacts: FactMap = {
        age: 25,
        gender: 'female' as const,
        state: 'TN' as const,
      };

      const result = evaluateEligibility(userFacts, EXAMPLE_SCHEME);

      expect(result.status).toBe('undetermined');
      expect(result.missingFields.length).toBeGreaterThanOrEqual(1);
      expect(result.missingFields).toContain('owns_house');
      expect(result.missingFields).toContain('annual_income');
    });

    it('should return undetermined when all facts are missing', () => {
      const userFacts: FactMap = {};

      const result = evaluateEligibility(userFacts, EXAMPLE_SCHEME);

      expect(result.status).toBe('undetermined');
      expect(result.missingFields.length).toBeGreaterThan(0);
    });
  });

  describe('invalid input tests', () => {
    it('should handle invalid age (negative)', () => {
      const userFacts: FactMap = {
        age: -5,
        gender: 'female' as const,
        state: 'TN' as const,
        owns_house: false,
        annual_income: 100000,
        marital_status: 'single' as const,
        occupation: 'homemaker' as const,
      };

      const result = evaluateEligibility(userFacts, EXAMPLE_SCHEME);

      // Invalid ages should cause unknown outcomes
      expect(result.status).toBe('undetermined');
    });

    it('should handle invalid state code', () => {
      const userFacts: FactMap = {
        age: 30,
        gender: 'female' as const,
        state: 'KA' as const,
        owns_house: false,
        annual_income: 200000,
        marital_status: 'single' as const,
        occupation: 'homemaker' as const,
      };

      const result = evaluateEligibility(userFacts, EXAMPLE_SCHEME);

      expect(result.status).toBe('not_eligible');
      const stateFailure = result.failedRules.find(
        (r) => r.reasonCode === 'STATE_NOT_COVERED',
      );
      expect(stateFailure).toBeDefined();
    });
  });

  describe('scheme metadata', () => {
    it('should include scheme ID and version in result', () => {
      const userFacts: FactMap = {
        age: 30,
        gender: 'female' as const,
        state: 'TN' as const,
        owns_house: false,
        annual_income: 200000,
        marital_status: 'single' as const,
        occupation: 'homemaker' as const,
      };

      const result = evaluateEligibility(userFacts, EXAMPLE_SCHEME);

      expect(result.schemeId).toBe('example-housing-001');
      expect(result.schemeVersion).toBe(1);
      expect(result.engineVersion).toBe('1.0.0');
    });
  });
});

/**
 * Regression tests for conversation flow with Tamil input
 */

import type { ConversationState } from '@/src/types/conversation';
import type { ChatResponse } from '@/src/server/conversation/types';

describe('Conversation Flow - Tamil Input Tests', () => {
  describe('broad women assistance request', () => {
    it('should not ask "which scheme" for women assistance request', async () => {
      const { processMessage } = await import('@/src/server/conversation/service');
      
      // This is the exact Tamil input that was failing
      const userMessage = "எனக்கு பெண்களுக்கான அரசு உதவித் திட்டம் வேண்டும்.";
      
      // Process with a test session
      const response = await processMessage('test-regression-001', userMessage, 'ta');
      
      // The response should NOT be the "which scheme" question
      const isSchemeClarification = response.response.includes('எந்த திட்டத்தைப் பற்றி') || 
                                     response.response.includes('Which scheme');
      
      expect(isSchemeClarification).toBe(false);
      
      // The conversation should move toward eligibility (not stuck asking for scheme name)
      // The key is that nextQuestion or response should be about eligibility facts, not scheme name
      expect(response.status).toBeOneOf(['needs_information', 'eligible', 'not_eligible', 'undetermined']);
    });
  });
});

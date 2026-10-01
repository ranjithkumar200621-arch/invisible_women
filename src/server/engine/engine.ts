/**
 * src/server/engine/engine.ts — Eligibility engine
 *
 * Evaluates a user's facts against a scheme's eligibility rules.
 * Returns structured eligibility results without any conversational logic.
 */

import type {
  Scheme,
  SchemeBrief,
} from '@/src/types/scheme';
import type {
  FactMap,
  EligibilityResult,
  EligibilityStatus,
  RuleOutcome,
  FactKey,
} from '@/src/types/eligibility';
import { evaluateRule } from './rules';

/**
 * Evaluate eligibility for a user against a scheme.
 *
 * This is a purely deterministic function that:
 * - Takes user facts and a scheme definition
 * - Evaluates all rules in the eligibility spec
 * - Returns a structured result with status, missing fields, and failure reasons
 *
 * The result does NOT contain natural language explanations.
 * The conversation/Gemini layer will convert these facts to natural language.
 */
export function evaluateEligibility(
  userFacts: FactMap,
  scheme: Scheme,
): EligibilityResult {
  const { eligibility, schemeId, version } = scheme;
  const { rules, askOrder } = eligibility;

  // Evaluate the main rule tree
  const mainOutcome = evaluateRule(rules, userFacts);

  // Collect all leaf outcomes from the rule tree for reporting
  const allOutcomes: RuleOutcome[] = collectAllOutcomes(rules, userFacts);

  // Categorize outcomes - but only include leaf rules
  // For 'any' groups, individual failures don't count as overall failures
  // if another child in the group passed
  const matchedRules: RuleOutcome[] = [];
  const failedRules: RuleOutcome[] = [];
  const unknownRules: RuleOutcome[] = [];

  for (const outcome of allOutcomes) {
    // Only leaf rules are included (not intermediate groups)
    if (outcome.field) {
      switch (outcome.result) {
        case 'pass':
          matchedRules.push(outcome);
          break;
        case 'fail':
          failedRules.push(outcome);
          break;
        case 'unknown':
          unknownRules.push(outcome);
          break;
      }
    }
  }

  // Determine overall status based on the main outcome
  // The main outcome represents the evaluation of the root group rule
  let status: EligibilityStatus;
  switch (mainOutcome.result) {
    case 'pass':
      status = 'eligible';
      break;
    case 'fail':
      status = 'not_eligible';
      break;
    case 'unknown':
      status = 'undetermined';
      break;
  }

  // Calculate missing fields (fields needed for evaluation that aren't known)
  // Only include fields that could change the outcome
  const missingFields: FactKey[] = [];
  for (const unknown of unknownRules) {
    if (unknown.field) {
      // Only add if it's in askOrder and could change the result
      if (askOrder.includes(unknown.field)) {
        missingFields.push(unknown.field);
      }
    }
  }

  // For eligible/not_eligible status, missingFields should be empty
  // (no more questions needed after a definite answer)
  if (status === 'eligible' || status === 'not_eligible') {
    missingFields.length = 0;
  }

  // Deduplicate reason codes
  const reasonCodes = Array.from(
    new Set([
      ...failedRules.map((r) => r.reasonCode),
      ...unknownRules.map((r) => r.reasonCode),
    ]),
  );

  return {
    schemeId,
    schemeVersion: version,
    engineVersion: '1.0.0',
    evaluatedAt: new Date().toISOString(),
    status,
    matchedRules,
    failedRules,
    unknownRules,
    missingFields,
    reasonCodes,
    factsUsed: userFacts,
  };
}

/**
 * Recursively collect all rule outcomes from the rule tree.
 */
function collectAllOutcomes(
  rule: any,
  facts: FactMap,
): RuleOutcome[] {
  if (rule.type === 'group') {
    const groupOutcome = evaluateRule(rule, facts);
    
    // If the group passes (for 'any' combinator) or fails ('all' or 'none'),
    // but has unknown children, we report the children as unknown
    // The group outcome itself determines pass/fail status
    
    // Collect all leaf outcomes from children
    return rule.rules.flatMap((child: any) => collectAllOutcomes(child, facts));
  }
  // Leaf rule - evaluate it
  return [evaluateRule(rule, facts)];
}

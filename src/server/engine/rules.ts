/**
 * src/server/engine/rules.ts — Rule evaluation logic
 *
 * Evaluates structured eligibility rules against user fact state.
 */

import type {
  Rule,
  LeafRule,
  GroupRule,
  RuleOutcome,
  TriState,
  FactMap,
  FactKey,
  RuleValue,
  ComparisonOperator,
} from '@/src/types/eligibility';
import { coerceFactValue } from './facts';

/**
 * Get the user's fact value for a field, or undefined if not known.
 */
function getFactValue(facts: FactMap, field: FactKey): unknown {
  return facts[field];
}

/**
 * Evaluate a leaf rule against the user's facts.
 */
export function evaluateLeafRule(
  rule: LeafRule,
  facts: FactMap,
): RuleOutcome {
  const { id, field, operator, reasonCode, description } = rule;
  const actualValue = getFactValue(facts, field);

  // If the fact is missing, return 'unknown'
  if (actualValue === undefined) {
    return {
      ruleId: id,
      reasonCode,
      description,
      result: 'unknown',
      field,
      operator,
    };
  }

  // Try to coerce the value - if it fails, treat as unknown
  const validValue = coerceFactValue(field, actualValue);
  if (validValue === undefined) {
    return {
      ruleId: id,
      reasonCode,
      description,
      result: 'unknown',
      field,
      operator,
      actual: actualValue as any,
    };
  }

  let result: TriState = 'pass';

  switch (operator) {
    case 'eq': {
      if (String(validValue) !== String(rule.value)) {
        result = 'fail';
      }
      break;
    }

    case 'neq': {
      if (String(validValue) === String(rule.value)) {
        result = 'fail';
      }
      break;
    }

    case 'gt': {
      if (typeof validValue !== 'number' || typeof rule.value !== 'number') {
        result = 'fail';
      } else if (!(validValue > rule.value)) {
        result = 'fail';
      }
      break;
    }

    case 'gte': {
      if (typeof validValue !== 'number' || typeof rule.value !== 'number') {
        result = 'fail';
      } else if (!(validValue >= rule.value)) {
        result = 'fail';
      }
      break;
    }

    case 'lt': {
      if (typeof validValue !== 'number' || typeof rule.value !== 'number') {
        result = 'fail';
      } else if (!(validValue < rule.value)) {
        result = 'fail';
      }
      break;
    }

    case 'lte': {
      if (typeof validValue !== 'number' || typeof rule.value !== 'number') {
        result = 'fail';
      } else if (!(validValue <= rule.value)) {
        result = 'fail';
      }
      break;
    }

    case 'between': {
      if (typeof validValue !== 'number') {
        result = 'fail';
      } else {
        const [min, max] = rule.value as [number, number];
        if (!(validValue >= min && validValue <= max)) {
          result = 'fail';
        }
      }
      break;
    }

    case 'in': {
      const values = rule.value as string[];
      if (!values.includes(String(validValue))) {
        result = 'fail';
      }
      break;
    }

    case 'not_in': {
      const values = rule.value as string[];
      if (values.includes(String(validValue))) {
        result = 'fail';
      }
      break;
    }

    case 'is_true': {
      if (validValue !== true) {
        result = 'fail';
      }
      break;
    }

    case 'is_false': {
      if (validValue !== false) {
        result = 'fail';
      }
      break;
    }

    default: {
      result = 'fail';
      console.warn(`Unknown operator: ${operator as string}`);
      break;
    }
  }

  return {
    ruleId: id,
    reasonCode,
    description,
    result,
    field,
    operator,
    expected: rule.value,
    actual: validValue,
  };
}

/**
 * Recursively evaluate a group rule.
 */
export function evaluateGroupRule(
  rule: GroupRule,
  facts: FactMap,
): RuleOutcome {
  const { id, combinator, reasonCode, description, rules } = rule;

  const outcomes = rules.map((child) => {
    if (child.type === 'group') {
      return evaluateGroupRule(child, facts);
    }
    return evaluateLeafRule(child, facts);
  });

  // Filter to only outcome results (not unknowns for counting)
  const passedOutcomes = outcomes.filter((o) => o.result === 'pass');
  const failedOutcomes = outcomes.filter((o) => o.result === 'fail');
  const unknownOutcomes = outcomes.filter((o) => o.result === 'unknown');

  let result: TriState;

  switch (combinator) {
    case 'all': {
      // All must pass
      if (failedOutcomes.length > 0) {
        result = 'fail';
      } else if (unknownOutcomes.length > 0) {
        result = 'unknown';
      } else {
        result = 'pass';
      }
      break;
    }

    case 'any': {
      // At least one must pass
      if (passedOutcomes.length > 0) {
        result = 'pass';
      } else if (unknownOutcomes.length > 0) {
        result = 'unknown';
      } else {
        result = 'fail';
      }
      break;
    }

    case 'none': {
      // None should pass (all should fail or be unknown)
      if (passedOutcomes.length > 0) {
        result = 'fail';
      } else if (unknownOutcomes.length > 0) {
        result = 'unknown';
      } else {
        result = 'pass';
      }
      break;
    }

    default: {
      result = 'fail';
      console.warn(`Unknown combinator: ${combinator as string}`);
      break;
    }
  }

  // Build the outcome record
  let outcome: RuleOutcome = {
    ruleId: id,
    reasonCode,
    description,
    result,
  };

  // Add field/operator if this is a group with no child outcomes that reveal more
  if (outcomes.length > 0) {
    const firstOutcome = outcomes[0];
    if (firstOutcome.field && firstOutcome.operator) {
      outcome = {
        ...outcome,
        field: firstOutcome.field,
        operator: firstOutcome.operator,
      };
    }
  }

  return outcome;
}

/**
 * Evaluate a rule (leaf or group) against user facts.
 */
export function evaluateRule(rule: Rule, facts: FactMap): RuleOutcome {
  if (rule.type === 'group') {
    return evaluateGroupRule(rule, facts);
  }
  return evaluateLeafRule(rule, facts);
}

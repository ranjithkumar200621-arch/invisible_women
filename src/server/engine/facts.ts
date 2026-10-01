/**
 * src/server/engine/facts.ts — Value validation and coercion
 *
 * Converts raw user input to typed values and validates them.
 * Does NOT evaluate eligibility rules—just validates fact values.
 */

import type {
  FactKey,
  FactValueTypes,
  FactValue,
  FactValueKind,
} from '@/src/types/eligibility';
import {
  FACT_KEYS,
  GENDERS,
  MARITAL_STATUSES,
  OCCUPATIONS,
  INDIAN_STATE_CODES,
} from '@/src/types/eligibility';

export function getFactType(key: FactKey): FactValueKind {
  switch (key) {
    case 'age':
    case 'annual_income':
    case 'number_of_children':
      return 'number';
    case 'gender':
    case 'marital_status':
    case 'state':
    case 'district':
    case 'occupation':
      return 'enum' as const;
    case 'owns_house':
    case 'is_pregnant_or_lactating':
    case 'has_bank_account':
      return 'boolean' as const;
  }
}

// Valid enum values per key
export const VALID_ENUM_VALUES: Record<FactKey, readonly string[]> = {
  age: [],
  gender: GENDERS,
  annual_income: [],
  state: Object.keys(INDIAN_STATE_CODES) as string[],
  district: [],
  occupation: OCCUPATIONS,
  marital_status: MARITAL_STATUSES,
  owns_house: [],
  is_pregnant_or_lactating: [],
  number_of_children: [],
  has_bank_account: [],
};

export interface ValidationResult<T> {
  valid: boolean;
  value?: T;
  reason?: string;
}

/**
 * Validate and coerce a raw value for a given fact key.
 * Returns the validated value or an error reason.
 */
export function validateFactValue(
  key: FactKey,
  rawValue: unknown,
): ValidationResult<FactValueTypes[FactKey]> {
  const type = getFactType(key);

  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return { valid: false, reason: 'value is empty' };
  }

  switch (type) {
    case 'number': {
      const num = Number(rawValue);
      if (isNaN(num) || !isFinite(num)) {
        return { valid: false, reason: 'value is not a valid number' };
      }
      // For integers
      const intVal = Math.floor(num);
      if (intVal < 0) {
        return { valid: false, reason: 'value must be non-negative' };
      }
      // Apply min/max constraints
      return { valid: true, value: intVal as FactValueTypes[FactKey] };
    }

    case 'boolean': {
      if (typeof rawValue === 'boolean') {
        return { valid: true, value: rawValue as FactValueTypes[FactKey] };
      }
      if (typeof rawValue === 'string') {
        const lower = rawValue.toLowerCase().trim();
        if (['true', 'yes', '1'].includes(lower)) {
          return { valid: true, value: true as FactValueTypes[FactKey] };
        }
        if (['false', 'no', '0'].includes(lower)) {
          return { valid: true, value: false as FactValueTypes[FactKey] };
        }
        return { valid: false, reason: 'value must be true/false/yes/no/1/0' };
      }
      return { valid: false, reason: 'value must be a boolean or string "true"/"false"' };
    }

    case 'enum': {
      if (typeof rawValue !== 'string') {
        return { valid: false, reason: 'value must be a string' };
      }
      const validValues = VALID_ENUM_VALUES[key];
      const normalized = rawValue.toLowerCase().trim();
      // For state codes, also check uppercase
      if (key === 'state') {
        const upper = rawValue.toUpperCase().trim();
        if (validValues.includes(upper)) {
          return { valid: true, value: upper as FactValueTypes[FactKey] };
        }
      }
      // For other enums, allow case-insensitive match
      for (const val of validValues) {
        if (val.toLowerCase() === normalized) {
          return { valid: true, value: val as FactValueTypes[FactKey] };
        }
      }
      return { valid: false, reason: `value must be one of: ${validValues.join(', ')}` };
    }

    case 'string': {
      if (typeof rawValue !== 'string') {
        return { valid: false, reason: 'value must be a string' };
      }
      if (rawValue.trim().length === 0) {
        return { valid: false, reason: 'value must not be empty' };
      }
      return { valid: true, value: rawValue as FactValueTypes[FactKey] };
    }
  }
}

/**
 * Coerce a raw fact value to the canonical type.
 * Returns the valid value or undefined if invalid.
 */
export function coerceFactValue(
  key: FactKey,
  rawValue: unknown,
): FactValueTypes[FactKey] | undefined {
  const result = validateFactValue(key, rawValue);
  return result.valid ? result.value : undefined;
}

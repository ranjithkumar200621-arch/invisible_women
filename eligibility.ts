/**
 * src/types/eligibility.ts — STABLE INTERFACE
 *
 * 1. Canonical fact registry (the ONLY vocabulary the system uses for user facts).
 * 2. Machine-evaluable rule DSL.
 * 3. Eligibility result shape.
 *
 * Rules for evolving this file:
 *   - To support a new scheme that needs a new fact: ADD a key to FACT_KEYS,
 *     FactValueTypes and FACT_DEFINITIONS. Never rename or repurpose a key.
 *   - If a scheme means something different by a fact (e.g. "individual income"
 *     vs "household income"), add a NEW key. Do not overload.
 *   - Nothing here may mention a natural language. Fact keys/enum values are
 *     English snake_case identifiers; user-facing words are produced by Gemini.
 */

// ---------------------------------------------------------------------------
// 1. Canonical facts
// ---------------------------------------------------------------------------

/** ISO 3166-2:IN style codes -> canonical English names. 28 states + 8 UTs. */
export const INDIAN_STATE_CODES = {
  AN: 'Andaman and Nicobar Islands', AP: 'Andhra Pradesh', AR: 'Arunachal Pradesh', AS: 'Assam',
  BR: 'Bihar', CH: 'Chandigarh', CG: 'Chhattisgarh', DH: 'Dadra and Nagar Haveli and Daman and Diu',
  DL: 'Delhi', GA: 'Goa', GJ: 'Gujarat', HR: 'Haryana', HP: 'Himachal Pradesh',
  JK: 'Jammu and Kashmir', JH: 'Jharkhand', KA: 'Karnataka', KL: 'Kerala', LA: 'Ladakh',
  LD: 'Lakshadweep', MP: 'Madhya Pradesh', MH: 'Maharashtra', MN: 'Manipur', ML: 'Meghalaya',
  MZ: 'Mizoram', NL: 'Nagaland', OD: 'Odisha', PY: 'Puducherry', PB: 'Punjab', RJ: 'Rajasthan',
  SK: 'Sikkim', TN: 'Tamil Nadu', TS: 'Telangana', TR: 'Tripura', UP: 'Uttar Pradesh',
  UK: 'Uttarakhand', WB: 'West Bengal',
} as const;
export type IndianStateCode = keyof typeof INDIAN_STATE_CODES;

export const GENDERS = ['female', 'male', 'other'] as const;
export type Gender = (typeof GENDERS)[number];

export const MARITAL_STATUSES = ['single', 'married', 'widowed', 'divorced_or_separated'] as const;
export type MaritalStatus = (typeof MARITAL_STATUSES)[number];

export const OCCUPATIONS = [
  'farmer', 'agricultural_laborer', 'daily_wage_worker', 'self_employed', 'salaried_private',
  'government_employee', 'homemaker', 'student', 'unemployed', 'other',
] as const;
export type Occupation = (typeof OCCUPATIONS)[number];

export const FACT_KEYS = [
  'age',
  'gender',
  'annual_income',
  'state',
  'district',
  'occupation',
  'marital_status',
  'owns_house',
  'is_pregnant_or_lactating',
  'number_of_children',
  'has_bank_account',
] as const;
export type FactKey = (typeof FACT_KEYS)[number];

export interface FactValueTypes {
  age: number;
  gender: Gender;
  annual_income: number; // INR per year, household
  state: IndianStateCode;
  district: string; // canonical English name, compared case-insensitively
  occupation: Occupation;
  marital_status: MaritalStatus;
  owns_house: boolean;
  is_pregnant_or_lactating: boolean;
  number_of_children: number;
  has_bank_account: boolean;
}
export type FactValue = FactValueTypes[FactKey];
/** The canonical, language-neutral user state. Missing key = not yet known. */
export type FactMap = Partial<FactValueTypes>;

export type FactValueKind = 'number' | 'boolean' | 'enum' | 'string';

export interface FactDefinition {
  key: FactKey;
  type: FactValueKind;
  enumValues?: readonly string[];
  /** Inclusive plausibility bounds for numbers. Values outside are rejected (not stored). */
  min?: number;
  max?: number;
  unit?: string;
  /** English. Injected into Gemini prompts so it knows exactly what the field means. */
  description: string;
  /** English. What the question should accomplish. Gemini phrases it in the user's language. */
  questionIntent: string;
  /** 'medium' facts must never be logged and are asked only if a rule needs them. */
  sensitivity: 'low' | 'medium';
}

export const FACT_DEFINITIONS: Record<FactKey, FactDefinition> = {
  age: {
    key: 'age', type: 'number', min: 0, max: 120, unit: 'years', sensitivity: 'low',
    description: "The user's age in completed years.",
    questionIntent: 'Ask how old she is, in years.',
  },
  gender: {
    key: 'gender', type: 'enum', enumValues: GENDERS, sensitivity: 'low',
    description: "The user's gender.",
    questionIntent: 'Ask whether the applicant is a woman, man, or other.',
  },
  annual_income: {
    key: 'annual_income', type: 'number', min: 0, max: 100_000_000, unit: 'INR per year', sensitivity: 'medium',
    description: "Total yearly income of the user's household in Indian rupees. If the user gives a daily/weekly/monthly amount, report the amount AS SAID and set `period`; do NOT convert it yourself.",
    questionIntent: 'Ask roughly how much money the whole family earns. An estimate is fine. Per day, per month or per year is fine.',
  },
  state: {
    key: 'state', type: 'enum', enumValues: Object.keys(INDIAN_STATE_CODES), sensitivity: 'low',
    description: 'The Indian state or union territory where the user lives, as a canonical state code.',
    questionIntent: 'Ask which state she lives in.',
  },
  district: {
    key: 'district', type: 'string', sensitivity: 'low',
    description: 'The district where the user lives, written in canonical English spelling.',
    questionIntent: 'Ask which district she lives in.',
  },
  occupation: {
    key: 'occupation', type: 'enum', enumValues: OCCUPATIONS, sensitivity: 'low',
    description: "The user's main work or occupation.",
    questionIntent: 'Ask what work she mainly does.',
  },
  marital_status: {
    key: 'marital_status', type: 'enum', enumValues: MARITAL_STATUSES, sensitivity: 'medium',
    description: "The user's marital status.",
    questionIntent: 'Gently ask whether she is married, unmarried, widowed, or separated/divorced.',
  },
  owns_house: {
    key: 'owns_house', type: 'boolean', sensitivity: 'low',
    description: 'True if the user or her household owns a house of its own (not rented, not living in someone else\'s house).',
    questionIntent: 'Ask whether her family has a house of their own.',
  },
  is_pregnant_or_lactating: {
    key: 'is_pregnant_or_lactating', type: 'boolean', sensitivity: 'medium',
    description: 'True if the user is currently pregnant or breastfeeding.',
    questionIntent: 'Gently ask whether she is currently pregnant or breastfeeding a baby.',
  },
  number_of_children: {
    key: 'number_of_children', type: 'number', min: 0, max: 20, sensitivity: 'low',
    description: 'Number of living children the user has.',
    questionIntent: 'Ask how many children she has.',
  },
  has_bank_account: {
    key: 'has_bank_account', type: 'boolean', sensitivity: 'low',
    description: 'True if the user has a bank or post-office savings account in her own name. Do NOT ask for the account number.',
    questionIntent: 'Ask whether she has a bank account in her own name. Never ask for the account number.',
  },
};

// ---------------------------------------------------------------------------
// 2. Rule DSL (machine-evaluable; natural-language text is documentation only)
// ---------------------------------------------------------------------------

export type ComparisonOperator =
  | 'eq' | 'neq'
  | 'gt' | 'gte' | 'lt' | 'lte'
  | 'between' // value: [min, max], inclusive
  | 'in' | 'not_in' // value: array
  | 'is_true' | 'is_false'; // boolean facts; no value

export type RuleValue = number | string | boolean | ReadonlyArray<string | number>;

interface RuleBase {
  /** Unique within the scheme, e.g. "R_AGE_MIN". Stable: used in tests, logs, audit. */
  id: string;
  /** UPPER_SNAKE code reported when this rule fails, e.g. "AGE_BELOW_MINIMUM". */
  reasonCode: string;
  /** English, for developers/reviewers/Gemini grounding. Never shown raw to the user. */
  description: string;
  /** Pointer into the official source, e.g. "Guidelines §3.2" or a verbatim short quote. */
  sourceRef?: string;
}

export interface LeafRule extends RuleBase {
  type: 'leaf';
  field: FactKey;
  operator: ComparisonOperator;
  value?: RuleValue;
}

/**
 * all  : every child must pass                      (AND)
 * any  : at least one child must pass               (OR)
 * none : no child may pass (exclusion list)         (NOT-ANY)
 */
export interface GroupRule extends RuleBase {
  type: 'group';
  combinator: 'all' | 'any' | 'none';
  rules: Rule[];
}

export type Rule = LeafRule | GroupRule;

/** What a scheme declares for the engine. */
export interface EligibilitySpec {
  rules: Rule;
  /**
   * Question order, most decisive / cheapest-to-answer first. MUST contain exactly
   * the set of fields referenced by `rules` (enforced by scheme validator).
   */
  askOrder: FactKey[];
}

// ---------------------------------------------------------------------------
// 3. Evaluation result
// ---------------------------------------------------------------------------

export const ELIGIBILITY_ENGINE_VERSION = '1.0.0';

/** Kleene three-valued logic. 'unknown' = a needed fact is missing. */
export type TriState = 'pass' | 'fail' | 'unknown';

export interface RuleOutcome {
  ruleId: string;
  reasonCode: string;
  description: string;
  result: TriState;
  field?: FactKey;
  operator?: ComparisonOperator;
  expected?: RuleValue;
  /** The fact value the engine saw (undefined if unknown). */
  actual?: FactValue;
}

export type EligibilityStatus = 'eligible' | 'not_eligible' | 'undetermined';

export interface EligibilityResult {
  schemeId: string;
  schemeVersion: number;
  engineVersion: string;
  evaluatedAt: string; // ISO-8601
  status: EligibilityStatus;
  /** Leaf (or reasonCode-bearing group) outcomes on the decisive path that passed. */
  matchedRules: RuleOutcome[];
  /** Outcomes that caused 'not_eligible'. Empty unless status === 'not_eligible'. */
  failedRules: RuleOutcome[];
  /** Leaves that could not be evaluated because a fact is missing. */
  unknownRules: RuleOutcome[];
  /**
   * Fields that could still change the outcome, ordered by scheme.askOrder.
   * EMPTY when status is 'not_eligible' (never ask more questions after a definite no)
   * and when status is 'eligible'.
   */
  missingFields: FactKey[];
  /** Deduplicated reasonCodes of failedRules (or unknownRules when undetermined). */
  reasonCodes: string[];
  /** Snapshot of the facts used. */
  factsUsed: FactMap;
}

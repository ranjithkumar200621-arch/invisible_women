/**
 * src/types/scheme.ts — STABLE INTERFACE
 *
 * A Scheme is a verified, versioned, structured record of ONE government
 * scheme. It is the single source of truth for everything the system says
 * about a scheme: rules, documents, steps, URLs. Gemini may TRANSLATE and
 * SIMPLIFY these fields; it may never originate or alter them.
 *
 * Runtime serves a scheme only if:
 *   status === 'active' AND verification.verifiedAt !== null
 * (unless ALLOW_DRAFT_SCHEMES=true, which is forbidden in production).
 */
import type { EligibilitySpec } from './eligibility';
import type { LanguageCode } from './language';
import type { IndianStateCode } from './eligibility';

export const SCHEME_SCHEMA_VERSION = 1;

export type SchemeStatus = 'draft' | 'pending_review' | 'active' | 'deprecated' | 'retired';

export interface BenefitItem {
  id: string; // stable, e.g. "B1"
  text: string; // English, plain
  amount?: {
    value: number;
    currency: 'INR';
    frequency: 'one_time' | 'monthly' | 'quarterly' | 'yearly';
  };
}

export interface DocumentItem {
  id: string; // stable, e.g. "D_ID"
  /** English name, e.g. "Proof of identity". */
  name: string;
  /** English, plain-language: what it is and acceptable alternatives. */
  description: string;
  mandatory: boolean;
  /** English: where/how she can obtain it if she doesn't have it. */
  howToObtain?: string;
}

export interface ApplicationStep {
  id: string; // stable, e.g. "S1"
  order: number; // 1-based, unique
  text: string; // English, imperative, one action per step
  channel: 'online' | 'offline' | 'either';
  /** Must be on an allowed official host; validated. */
  url?: string;
}

export interface Helpline {
  name: string;
  /** Digits only, e.g. "14555" or "1800xxxxxxx". Shown on screen; spoken only if reliably verified. */
  number: string;
  hours?: string;
}

/**
 * Optional HUMAN-REVIEWED translations. If present for the user's language,
 * the UI/compose layer prefers these over machine translation.
 * Keyed by the same ids as the English items so structure can't drift.
 */
export interface LocalizedSchemeContent {
  name?: string;
  shortDescription?: string;
  benefits?: Record<string, string>; // BenefitItem.id -> text
  documents?: Record<string, { name: string; description: string }>; // DocumentItem.id ->
  steps?: Record<string, string>; // ApplicationStep.id -> text
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface SchemeVerification {
  /** null until a human verifies against the official source. */
  verifiedAt: string | null;
  verifiedBy: string | null;
  method: 'manual' | 'ingestion_reviewed' | null;
  /** When the official page/PDF was last fetched/read. */
  sourceRetrievedAt: string | null;
  /** SHA-256 of the raw source snapshot, if captured by the ingestion tool. */
  sourceContentHash: string | null;
  /** Free text: which document/section was used (e.g. "Operational Guidelines 2024, §4"). */
  sourceDescription: string;
}

export interface Scheme {
  schemaVersion: typeof SCHEME_SCHEMA_VERSION;
  /** Canonical, immutable id. kebab-case. */
  schemeId: string;
  /** Monotonically increasing integer; each approved change = new version. */
  version: number;
  status: SchemeStatus;

  /** Canonical English name. */
  name: string;
  /** Human-reviewed localized names (optional). Machine translation is allowed at runtime for names not listed. */
  localizedNames: Partial<Record<LanguageCode, string>>;
  shortDescription: string; // 1 sentence, plain English
  description: string; // 2-4 sentences, plain English
  /** English keywords/phrases used ONLY to help Gemini match the user's need to this scheme. */
  tags: string[];

  jurisdiction: { level: 'central' | 'state'; stateCode?: IndianStateCode };
  sourceOrganization: string; // e.g. "Ministry of ..." / "Department of ... , Government of ..."

  benefits: BenefitItem[];
  eligibility: EligibilitySpec;
  requiredDocuments: DocumentItem[];
  applicationSteps: ApplicationStep[];
  helplines?: Helpline[];

  /** Where the user actually applies (shown as a button/QR, never read out by TTS). */
  officialApplicationUrl: string;
  /** The authoritative page/document this record was derived from. */
  officialSourceUrl: string;

  validity?: { effectiveFrom?: string; effectiveUntil?: string };
  verification: SchemeVerification;

  localizedContent?: Partial<Record<LanguageCode, LocalizedSchemeContent>>;
  /** Not shown to users. Reviewer notes, known gaps, fixture warnings. */
  internalNotes?: string[];

  createdAt: string;
  updatedAt: string;
}

/** Minimal projection passed to Gemini (intent matching and composing). No rules. */
export interface SchemeBrief {
  schemeId: string;
  name: string;
  localizedName?: string;
  shortDescription: string;
  tags: string[];
}

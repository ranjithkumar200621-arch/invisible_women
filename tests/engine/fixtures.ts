/**
 * tests/engine/fixtures.ts — Test fixtures
 *
 * Provides the example scheme for eligibility engine tests.
 */

import type { Scheme } from '@/src/types/scheme';
import { EXAMPLE_SCHEME_JSON } from './example-scheme';

// Load the example scheme
export const EXAMPLE_SCHEME: Scheme = EXAMPLE_SCHEME_JSON;

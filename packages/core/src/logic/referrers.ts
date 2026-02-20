import type { ReferrerAnnotation } from '../types/models.js';

export function analyzeReferrers(referrers: string[]): ReferrerAnnotation[] {
  return referrers.map((value) => {
    const trimmed = value.trim();

    if (trimmed === '*') {
      return {
        value,
        warning: true,
        reason: 'wildcard-only'
      };
    }

    if (trimmed.includes('*') || trimmed.startsWith('http://')) {
      return {
        value,
        warning: true,
        reason: 'permissive-pattern'
      };
    }

    return {
      value,
      warning: false,
      reason: 'none'
    };
  });
}


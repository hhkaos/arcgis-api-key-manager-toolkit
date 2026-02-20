import type { ExpirationCategory } from '../types/models.js';

const MS_PER_DAY = 86_400_000;

export function categorizeExpiration(expirationIso: string, now: Date = new Date()): ExpirationCategory {
  const expiration = Date.parse(expirationIso);
  if (Number.isNaN(expiration)) {
    throw new Error(`Invalid expiration date: "${expirationIso}".`);
  }

  const diffDays = Math.floor((expiration - now.getTime()) / MS_PER_DAY);
  if (diffDays < 0) {
    return 'expired';
  }
  if (diffDays < 7) {
    return 'critical';
  }
  if (diffDays <= 30) {
    return 'warning';
  }
  return 'ok';
}


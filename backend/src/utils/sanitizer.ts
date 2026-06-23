import { logger } from '../utils/logger';

/**
 * Sanitize a string value for safe use in MongoDB queries.
 * Removes MongoDB operators ($, .) and trims whitespace.
 */
export function sanitizeString(value: string): string {
  if (!value || typeof value !== 'string') return '';
  return value
    .trim()
    .replace(/\$/g, '')
    .replace(/\./g, '');
}

/**
 * Sanitize an object for safe use in MongoDB queries.
 * Recursively removes $ and . from keys and string values.
 */
export function sanitizeObject(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const safeKey = sanitizeString(key);
    if (Array.isArray(value)) {
      result[safeKey] = value.map((v) =>
        typeof v === 'string' ? sanitizeString(v) : v
      );
    } else if (typeof value === 'object' && value !== null) {
      result[safeKey] = sanitizeObject(value);
    } else if (typeof value === 'string') {
      result[safeKey] = sanitizeString(value);
    } else {
      result[safeKey] = value;
    }
  }
  return result;
}

/**
 * Validate that a userId is safe for MongoDB queries.
 * Only allows alphanumeric, hyphens, and underscores.
 */
export function validateUserId(userId: string): boolean {
  if (!userId || typeof userId !== 'string') return false;
  return /^[a-zA-Z0-9_-]+$/.test(userId);
}

/**
 * Sanitize and validate a wallet address for MongoDB storage.
 */
export function sanitizeWalletAddress(address: string): string | null {
  if (!address || typeof address !== 'string') return null;
  const trimmed = address.trim().toLowerCase();
  // Only allow xdc..., txdc..., or 0x... formats
  if (/^xdc[0-9a-f]{40}$/.test(trimmed)) return trimmed;
  if (/^txdc[0-9a-f]{40}$/.test(trimmed)) return trimmed;
  if (/^0x[0-9a-f]{40}$/.test(trimmed)) return trimmed;
  return null;
}

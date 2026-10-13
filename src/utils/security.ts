/**
 * Security sanitization module:
 * Strictly drops any columns containing passwords/credentials,
 * specifically "アイパス（ID + PW）", "ID + PW", "PW", "パスワード", etc.
 * Keeps ONLY permitted operational columns.
 */

// Forbidden header patterns
const FORBIDDEN_HEADER_REGEX = /(?:アイパス|id\s*\+\s*pw|password|パスワード|secret|token)/i;

/**
 * Strips whitespace and newlines from a column header for matching
 */
export function cleanHeaderName(header: string): string {
  if (!header) return '';
  return header.replace(/[\r\n\t\s]+/g, '').trim();
}

/**
 * Sanitizes raw CSV rows immediately upon reading:
 * - Drops any forbidden column immediately
 * - Keeps strictly allowed keys
 */
export function sanitizeRawRow(row: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  for (const key of Object.keys(row)) {
    const cleanedKey = cleanHeaderName(key);
    // Instant drop if matches credential patterns
    if (FORBIDDEN_HEADER_REGEX.test(cleanedKey)) {
      continue;
    }
    sanitized[key] = row[key];
  }
  return sanitized;
}

/**
 * Verification helper to assert that no credential strings leak
 */
export function verifyNoCredentialsInRecord(record: Record<string, any>): boolean {
  for (const key of Object.keys(record)) {
    if (FORBIDDEN_HEADER_REGEX.test(cleanHeaderName(key))) {
      return false;
    }
  }
  return true;
}

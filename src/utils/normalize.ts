/**
 * Normalization utilities for company names, DYMTASK IDs, dates, and times.
 */

/**
 * Normalizes company name:
 * 1. NFKC unicode normalization
 * 2. Strip brackets like 【...】, […], （…）
 * 3. Strip extra spaces
 */
export function normalizeCompanyName(
  rawName: string | undefined | null,
  mergeRules: Record<string, string> = {}
): { canonical: string; cleaned: string } {
  if (!rawName) return { canonical: '未設定', cleaned: '' };

  let cleaned = String(rawName).normalize('NFKC').trim();

  // Remove wrapping or prefix/suffix bracketed tags like 【...】 or [...]
  cleaned = cleaned.replace(/【[^】]*】/g, '');
  cleaned = cleaned.replace(/\[[^\]]*\]/g, '');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  if (!cleaned) {
    cleaned = String(rawName).normalize('NFKC').trim();
  }

  // Check if there is an explicit merge rule in settings
  let canonical = cleaned;
  if (mergeRules[rawName]) {
    canonical = mergeRules[rawName];
  } else if (mergeRules[cleaned]) {
    canonical = mergeRules[cleaned];
  }

  return { canonical, cleaned };
}

/**
 * Extracts the primary 6-digit DYMTASK ID.
 * - Strips leading/trailing tabs, spaces, newlines
 * - If multiple IDs exist, extracts the first 6-digit sequence
 */
export function extractDymTaskId(rawVal: any): string | null {
  if (rawVal === undefined || rawVal === null) return null;
  const str = String(rawVal).replace(/[\t\r\n]/g, ' ').trim();
  if (!str) return null;

  // Find first 6-digit sequence
  const match = str.match(/\b\d{6}\b/) || str.match(/\d{6}/);
  if (match) {
    return match[0];
  }

  // If cell contains numbers
  const digitsOnly = str.replace(/\D/g, '');
  if (digitsOnly.length === 6) {
    return digitsOnly;
  }
  if (digitsOnly.length > 6) {
    return digitsOnly.slice(0, 6);
  }

  return null;
}

/**
 * Parses numeric minutes from values like "30", "45分", "1.5"
 */
export function parseMinutes(val: any): number | null {
  if (val === undefined || val === null || val === '') return null;
  const str = String(val).replace(/[,分min]/g, '').trim();
  const num = parseFloat(str);
  return isNaN(num) ? null : Math.round(num);
}

/**
 * Parses date string in format dd/mm/yyyy HH:MM:SS or yyyy/mm/dd HH:MM:SS or yyyy-mm-dd
 */
export function parseDateTime(dateStr: string | undefined | null): Date | null {
  if (!dateStr) return null;
  const str = String(dateStr).trim();
  if (!str) return null;

  // Format: yyyy/mm/dd or yyyy-mm-dd
  const ymdMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    const hour = ymdMatch[4] ? parseInt(ymdMatch[4], 10) : 0;
    const min = ymdMatch[5] ? parseInt(ymdMatch[5], 10) : 0;
    const sec = ymdMatch[6] ? parseInt(ymdMatch[6], 10) : 0;
    const d = new Date(year, month, day, hour, min, sec);
    if (!isNaN(d.getTime())) return d;
  }

  // Format: dd/mm/yyyy HH:MM:SS
  const dmyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const hour = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
    const min = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
    const sec = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;
    const d = new Date(year, month, day, hour, min, sec);
    if (!isNaN(d.getTime())) return d;
  }

  const standard = new Date(str);
  return isNaN(standard.getTime()) ? null : standard;
}

/**
 * Formats a Date object into Japanese format: yyyy/MM/dd HH:mm
 */
export function formatDateTime(d: Date | null): string {
  if (!d) return '—';
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hour = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `${year}/${month}/${day} ${hour}:${min}`;
}

/**
 * Formats a Date object into Japanese date format: yyyy/MM/dd
 */
export function formatDateOnly(d: Date | null): string {
  if (!d) return '—';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}

/**
 * Parses a Google Spreadsheet URL and extracts BOOK_ID and GID.
 * Supports:
 * - https://docs.google.com/spreadsheets/d/{BOOK_ID}/edit#gid={GID}
 * - https://docs.google.com/spreadsheets/d/{BOOK_ID}/edit?gid={GID}
 */
export function parseGoogleSheetUrl(url: string): { bookId?: string; gid?: string } {
  if (!url) return {};
  const trimmed = url.trim();
  const res: { bookId?: string; gid?: string } = {};

  const bookMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (bookMatch && bookMatch[1]) {
    res.bookId = bookMatch[1];
  }

  const gidMatch = trimmed.match(/[?#&]gid=([0-9]+)/i);
  if (gidMatch && gidMatch[1]) {
    res.gid = gidMatch[1];
  }

  return res;
}

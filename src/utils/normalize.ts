/**
 * Generates a clean aggregation group key for company name:
 * - Unicode NFKC
 * - Strip 【...】, [...], （...）
 * - Strip "DYM for" / "株式会社DYM for" / "(株)DYM for" prefixes
 * - Strip legal forms: 株式会社, 有限会社, 合同会社, (株), (有), （株）, （有）
 * - Strip whitespace
 * - Lowercase
 */
export function getCompanyGroupKey(rawName: string | undefined | null): string {
  if (!rawName) return '';
  let str = String(rawName).normalize('NFKC').trim();

  // Strip brackets
  str = str.replace(/【[^】]*】/g, '');
  str = str.replace(/\[[^\]]*\]/g, '');
  str = str.replace(/（[^）]*）/g, '');

  // Strip "DYM for" prefix patterns
  str = str.replace(/^(?:(?:株式会社|有限会社|合同会社|\(株\)|\(有\)|（株）|（有）)?\s*DYM\s*(?:for|FOR)\s*)/i, '');
  str = str.replace(/\bDYM\s+for\s+/gi, '');

  // Strip legal corporate entities
  str = str.replace(/(?:株式会社|有限会社|合同会社|\(株\)|\(有\)|（株）|（有）)/g, '');

  // Strip all whitespaces
  str = str.replace(/[\s\u3000]+/g, '');

  return str.toLowerCase();
}

/**
 * Normalizes company name:
 * 1. NFKC unicode normalization
 * 2. Strip brackets like 【...】, […], （…）
 * 3. Strip extra spaces
 * 4. Apply mergeRules (direct, cleaned, or groupKey)
 */
export function normalizeCompanyName(
  rawName: string | undefined | null,
  mergeRules: Record<string, string> = {}
): { canonical: string; cleaned: string; groupKey: string } {
  if (!rawName) return { canonical: '未設定', cleaned: '', groupKey: '' };

  let cleaned = String(rawName).normalize('NFKC').trim();

  // Remove wrapping or prefix/suffix bracketed tags like 【...】 or [...]
  cleaned = cleaned.replace(/【[^】]*】/g, '');
  cleaned = cleaned.replace(/\[[^\]]*\]/g, '');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // Strip prefix "DYM for"
  cleaned = cleaned.replace(/^(?:(?:株式会社|有限会社|合同会社|\(株\)|\(有\)|（株）|（有）)?\s*DYM\s*(?:for|FOR)\s*)/i, '');

  if (!cleaned) {
    cleaned = String(rawName).normalize('NFKC').trim();
  }

  const groupKey = getCompanyGroupKey(cleaned) || getCompanyGroupKey(rawName);

  // Check if there is an explicit merge rule in settings
  let canonical = cleaned;
  if (mergeRules[rawName]) {
    canonical = mergeRules[rawName];
  } else if (mergeRules[cleaned]) {
    canonical = mergeRules[cleaned];
  } else if (groupKey && mergeRules[groupKey]) {
    canonical = mergeRules[groupKey];
  }

  return { canonical, cleaned, groupKey };
}

/**
 * Computes bigram similarity (Dice coefficient) between two strings (0.0 to 1.0)
 */
export function calculateBigramSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1.0;
  if (!str1 || !str2) return 0.0;

  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  if (s1 === s2) return 1.0;

  if (s1.length < 2 || s2.length < 2) {
    return s1.includes(s2) || s2.includes(s1) ? 0.8 : 0.0;
  }

  const pairs1 = new Set<string>();
  for (let i = 0; i < s1.length - 1; i++) {
    pairs1.add(s1.slice(i, i + 2));
  }

  const pairs2 = new Set<string>();
  for (let i = 0; i < s2.length - 1; i++) {
    pairs2.add(s2.slice(i, i + 2));
  }

  let intersection = 0;
  for (const p of pairs1) {
    if (pairs2.has(p)) intersection++;
  }

  return (2.0 * intersection) / (pairs1.size + pairs2.size);
}

export interface SimilarCompanyPair {
  nameA: string;
  nameB: string;
  similarity: number;
  reason: string;
}

/**
 * Detects pairs of similar company names for automatic suggestions in Settings
 */
export function detectSimilarCompanyPairs(
  companies: string[],
  existingMerges: Record<string, string> = {},
  threshold: number = 0.65
): SimilarCompanyPair[] {
  const uniqueNames = Array.from(new Set(companies.map((c) => c.trim()))).filter((c) => c.length >= 2);
  const pairs: SimilarCompanyPair[] = [];
  const checked = new Set<string>();

  for (let i = 0; i < uniqueNames.length; i++) {
    const a = uniqueNames[i];
    const keyA = getCompanyGroupKey(a);

    for (let j = i + 1; j < uniqueNames.length; j++) {
      const b = uniqueNames[j];
      const keyB = getCompanyGroupKey(b);

      const pairKey = a < b ? `${a}___${b}` : `${b}___${a}`;
      if (checked.has(pairKey)) continue;
      checked.add(pairKey);

      // Skip if already explicitly merged
      if (existingMerges[a] === b || existingMerges[b] === a) continue;

      // 1. Group keys exact match (e.g. DYM for X vs X)
      if (keyA && keyB && keyA === keyB) {
        pairs.push({
          nameA: a,
          nameB: b,
          similarity: 1.0,
          reason: '表記ゆれ・プレフィックス一致（同一グループ）',
        });
        continue;
      }

      // 2. Bigram similarity check
      const sim = calculateBigramSimilarity(keyA || a, keyB || b);
      if (sim >= threshold) {
        pairs.push({
          nameA: a,
          nameB: b,
          similarity: Math.round(sim * 100) / 100,
          reason: `類似度 ${Math.round(sim * 100)}%`,
        });
      }
    }
  }

  // Sort by highest similarity first
  pairs.sort((p1, p2) => p2.similarity - p1.similarity);
  return pairs.slice(0, 30); // Return top 30 suggested pairs
}

/**
 * Normalizes assignee name for cross-matching (registry 対応者 vs Dymtask ASSIGNEE)
 * Removes Vietnamese diacritics / accents, lowercase, removes spaces
 */
export function normalizeAssigneeName(name: string | undefined | null): string {
  if (!name) return '';
  return String(name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Strip diacritics
    .normalize('NFKC')
    .replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, '')
    .toUpperCase()
    .trim();
}

/**
 * Parses multiple assignees in a cell separated by commas, slashes, or &
 * e.g. "不可, HOANG THI LAN ANH" -> ["HOANG THI LAN ANH"]
 */
export function parseAssignees(rawAssignee: string | undefined | null): string[] {
  if (!rawAssignee) return [];
  const parts = String(rawAssignee).split(/[,/、+;&\n]/);
  const nonPersonTokens = new Set([
    '不可',
    '未定',
    'なし',
    '無し',
    '休止',
    '保留',
    '対応者未設定',
    '担当者未設定',
    'NONE',
    'NULL',
    '—',
    '-',
  ]);

  const result: string[] = [];
  for (let p of parts) {
    p = p.trim();
    if (!p) continue;
    if (nonPersonTokens.has(p)) continue;
    // Check if entire token is just punctuation
    if (/^[_\W]+$/.test(p)) continue;
    result.push(p);
  }

  return result.length > 0 ? result : [rawAssignee.trim()];
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

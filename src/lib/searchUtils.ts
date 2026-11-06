/**
 * Vietnamese diacritic-insensitive search and multi-token matching utilities.
 */

/**
 * Strips Vietnamese accents/diacritics, converts đ/Đ -> d, lowercases,
 * and collapses extra whitespace so users can search with or without accents.
 */
export function normalizeVietnameseText(input: string | number | null | undefined): string {
  if (input === null || input === undefined) return '';
  return String(input)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks whether every whitespace-separated token in `rawQuery` appears
 * in the normalized concatenation of `fields`.
 * Supports both accented and unaccented Vietnamese queries as well as
 * shorthand room queries like "p1", "phong 1", phone digits, or license plates.
 */
export function matchesSearchTokens(
  fields: Array<string | number | null | undefined>,
  rawQuery: string
): boolean {
  const normalizedQuery = normalizeVietnameseText(rawQuery);
  if (!normalizedQuery) return true;

  const tokens = normalizedQuery.split(' ').filter(Boolean);
  if (tokens.length === 0) return true;

  const rawJoined = fields
    .filter((f) => f !== null && f !== undefined && f !== '')
    .map((f) => String(f).toLowerCase())
    .join(' ');
  const normalizedHaystack = `${normalizeVietnameseText(rawJoined)} ${rawJoined}`;

  return tokens.every((token) => normalizedHaystack.includes(token));
}

/**
 * Extracts the given name (last word in a Vietnamese full name) for alphabetical sorting.
 */
export function getVietnameseGivenNameKey(fullName: string): string {
  const trimmed = (fullName || '').trim();
  if (!trimmed) return '';
  const parts = trimmed.split(/\s+/);
  const givenName = parts[parts.length - 1] || '';
  return `${normalizeVietnameseText(givenName)} ${normalizeVietnameseText(trimmed)}`;
}

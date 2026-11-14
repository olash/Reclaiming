/** Lower-cases, strips punctuation and collapses whitespace. */
export function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const NOISE = new Set(['late', 'the', 'of', 'estate', 'mr', 'mrs', 'miss', 'ms', 'dr', 'chief', 'alhaji', 'alhaja', 'deceased', 'and', 'est']);

/** The words of a name that actually identify a person. */
export function nameTokens(name: string): string[] {
  return normaliseName(name).split(' ').filter((w) => w.length > 1 && !NOISE.has(w));
}

/**
 * How many of the deceased's name words appear in the bank's account name.
 * A match needs at least two words (or every word, for a one- or two-word
 * name). Sharing a surname alone is NOT a match — that is exactly what a
 * relative's personal account looks like.
 */
export function matchesDeceasedName(accountName: string, deceasedName: string) {
  const wanted = nameTokens(deceasedName);
  const have = new Set(nameTokens(accountName));
  const hits = wanted.filter((w) => have.has(w)).length;
  const needed = Math.min(2, wanted.length);
  return { hits, needed, matched: wanted.length > 0 && hits >= needed };
}

/** True when the account is titled as an estate account, e.g. "ESTATE OF LATE SAMUEL BELLO". */
export function isEstateAccountName(accountName: string) {
  return /\bestate\s+of\b|\best\.?\s+of\s+(the\s+)?late\b|\b(administrators?|executors?)\s+of\b/i.test(accountName);
}

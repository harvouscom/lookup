// Deletion-neighbourhood vocabulary for typo correction. The index stores each token's
// one-character deletions, so a lookup is a few indexed point reads and never a scan.

export const MIN_TYPO_LENGTH = 4;

export function deletions1(token: string): string[] {
  const out = new Set<string>();
  for (let i = 0; i < token.length; i++) out.add(token.slice(0, i) + token.slice(i + 1));
  return [...out];
}

/** Keys to look up for a query token. Longer tokens also try two deletions, which reaches edit distance 2. */
export function lookupKeys(token: string): string[] {
  const keys = new Set<string>([token, ...deletions1(token)]);
  if (token.length >= 7) for (const d of deletions1(token)) for (const e of deletions1(d)) keys.add(e);
  return [...keys];
}

export const maxDistance = (length: number): number => (length >= 7 ? 2 : 1);

/** Optimal string alignment distance: insert, delete, substitute, swap adjacent. */
export function editDistance(a: string, b: string, limit = 3): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let prev2: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      let v = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2]! + 1);
      cur.push(v);
    }
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length]!;
}

export interface Candidate { token: string; df: number }

/** Closest token wins, then the most common. Ties on both go to alphabetical order, so results are stable. */
export function pickCorrection(token: string, candidates: Candidate[]): string | null {
  const limit = maxDistance(token.length);
  let best: { token: string; d: number; df: number } | null = null;
  for (const c of candidates) {
    if (c.token === token) continue;
    const d = editDistance(token, c.token, limit);
    if (d > limit) continue;
    if (!best || d < best.d || (d === best.d && (c.df > best.df || (c.df === best.df && c.token < best.token)))) {
      best = { token: c.token, d, df: c.df };
    }
  }
  return best?.token ?? null;
}

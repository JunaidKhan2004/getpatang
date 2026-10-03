/**
 * Single-elimination bracket maths. Pure functions, unit-tested in bracket.spec.ts.
 */

/** Smallest power of two that fits n players (at least 2). */
export function bracketSize(n: number): number {
  let size = 2;
  while (size < n) size *= 2;
  return size;
}

export const roundCount = (size: number) => Math.log2(size);

/**
 * Standard seeding order so the top seeds meet as late as possible.
 * size 8 → [1, 8, 4, 5, 2, 7, 3, 6]  (pairs: 1v8, 4v5, 2v7, 3v6)
 */
export function seedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const len = order.length * 2;
    order = order.flatMap((s) => [s, len + 1 - s]);
  }
  return order;
}

/**
 * First-round pairings for players already sorted by seed (index 0 = seed 1).
 * Missing opponents are byes (null); with standard seeding they go to the top seeds,
 * and a pairing never has two byes.
 */
export function firstRoundPairs<T>(seeded: T[]): [T | null, T | null][] {
  const size = bracketSize(seeded.length);
  const order = seedOrder(size);
  const pairs: [T | null, T | null][] = [];
  for (let i = 0; i < size; i += 2) {
    pairs.push([seeded[order[i] - 1] ?? null, seeded[order[i + 1] - 1] ?? null]);
  }
  return pairs;
}

export function roundName(round: number, totalRounds: number): string {
  const fromEnd = totalRounds - round;
  if (fromEnd === 0) return 'Final';
  if (fromEnd === 1) return 'Semi-finals';
  if (fromEnd === 2) return 'Quarter-finals';
  return `Round of ${2 ** (fromEnd + 1)}`;
}

/** Final placement of a player knocked out in `round`: final loser 2, semi-final losers 3, quarter-final losers 5, … */
export function placementForLoss(round: number, totalRounds: number): number {
  return 2 ** (totalRounds - round) + 1;
}

export interface RankingPointsConfig {
  /** Points by final placement (1, 2, 3, 5, 9, 17, …). Unlisted placements get 0. */
  placement: Record<string, number>;
  /** Every player who played at least one real match. */
  participation: number;
  /** Per match won (byes and walkovers received do not count). */
  perWin: number;
}

export function rankingPoints(cfg: RankingPointsConfig, placement: number, wins: number): number {
  return (cfg.placement[String(placement)] ?? 0) + cfg.participation + cfg.perWin * wins;
}

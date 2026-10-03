import { bracketSize, firstRoundPairs, placementForLoss, rankingPoints, roundName, seedOrder } from './bracket.js';

describe('bracket', () => {
  it('sizes the bracket to the next power of two', () => {
    expect([2, 3, 4, 5, 8, 9, 16, 17].map(bracketSize)).toEqual([2, 4, 4, 8, 8, 16, 16, 32]);
    expect(bracketSize(1)).toBe(2);
  });

  it('uses standard seeding', () => {
    expect(seedOrder(2)).toEqual([1, 2]);
    expect(seedOrder(4)).toEqual([1, 4, 2, 3]);
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });

  it('gives byes to the top seeds and never pairs two byes', () => {
    for (let n = 2; n <= 33; n++) {
      const players = Array.from({ length: n }, (_, i) => i + 1);
      const pairs = firstRoundPairs(players);
      expect(pairs).toHaveLength(bracketSize(n) / 2);
      expect(pairs.flat().filter((p) => p !== null).sort((a, b) => a! - b!)).toEqual(players);
      expect(pairs.some(([a, b]) => a === null && b === null)).toBe(false);
      const byes = pairs.filter(([a, b]) => a === null || b === null).map(([a, b]) => a ?? b);
      expect(byes.sort((a, b) => a! - b!)).toEqual(players.slice(0, bracketSize(n) - n));
    }
  });

  it('names rounds and placements', () => {
    expect([1, 2, 3, 4].map((r) => roundName(r, 4))).toEqual(['Round of 16', 'Quarter-finals', 'Semi-finals', 'Final']);
    expect([4, 3, 2, 1].map((r) => placementForLoss(r, 4))).toEqual([2, 3, 5, 9]);
  });

  it('adds placement, participation and win points', () => {
    const cfg = { placement: { '1': 100, '2': 70, '3': 40 }, participation: 5, perWin: 3 };
    expect(rankingPoints(cfg, 1, 3)).toBe(114);
    expect(rankingPoints(cfg, 9, 0)).toBe(5);
  });
});

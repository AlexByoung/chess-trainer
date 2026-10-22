import { describe, expect, it } from 'vitest';
import { glicko2, INITIAL, MIN_RD, updateForPuzzle } from './rating';

describe('glicko2', () => {
  it('matches the worked example in Glickman’s paper', () => {
    const r = glicko2({ rating: 1500, rd: 200, vol: 0.06 }, [
      { rating: 1400, rd: 30, score: 1 },
      { rating: 1550, rd: 100, score: 0 },
      { rating: 1700, rd: 300, score: 0 },
    ]);
    expect(r.rating).toBeCloseTo(1464.06, 1);
    expect(r.rd).toBeCloseTo(151.52, 1);
    expect(r.vol).toBeCloseTo(0.05999, 4);
  });

  it('only inflates RD when no games are played', () => {
    const r = glicko2({ rating: 1500, rd: 50, vol: 0.06 }, []);
    expect(r.rating).toBe(1500);
    expect(r.rd).toBeGreaterThan(50);
  });
});

describe('updateForPuzzle', () => {
  it('starts at 1200', () => {
    expect(INITIAL.rating).toBe(1200);
  });

  it('goes up on a solve and down on a fail', () => {
    const up = updateForPuzzle(INITIAL, 1200, true);
    const down = updateForPuzzle(INITIAL, 1200, false);
    expect(up.rating).toBeGreaterThan(1200);
    expect(down.rating).toBeLessThan(1200);
    // Symmetric around an equal-rated puzzle.
    expect(up.rating - 1200).toBeCloseTo(1200 - down.rating, 6);
  });

  it('rewards beating a harder puzzle more than an easier one', () => {
    const hard = updateForPuzzle(INITIAL, 1600, true).rating - 1200;
    const easy = updateForPuzzle(INITIAL, 800, true).rating - 1200;
    expect(hard).toBeGreaterThan(easy);
    expect(easy).toBeGreaterThan(0);
  });

  it('penalises failing an easy puzzle more than a hard one', () => {
    const easy = 1200 - updateForPuzzle(INITIAL, 800, false).rating;
    const hard = 1200 - updateForPuzzle(INITIAL, 1600, false).rating;
    expect(easy).toBeGreaterThan(hard);
  });

  it('shrinks the deviation as results accumulate but never below the floor', () => {
    let p = INITIAL;
    // Winning half of the puzzles rated 1200 should settle near 1200.
    for (let i = 0; i < 200; i++) p = updateForPuzzle(p, 1200, i % 2 === 0);
    expect(p.rd).toBeGreaterThanOrEqual(MIN_RD);
    expect(p.rd).toBeLessThan(INITIAL.rd);
    expect(Math.abs(p.rating - 1200)).toBeLessThan(100);
  });

  it('moves less once the rating is established', () => {
    const fresh = updateForPuzzle(INITIAL, 1200, true).rating - 1200;
    const settled = updateForPuzzle({ rating: 1200, rd: MIN_RD, vol: 0.06 }, 1200, true).rating - 1200;
    expect(settled).toBeLessThan(fresh);
    expect(settled).toBeGreaterThan(3);
  });
});

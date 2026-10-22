import { describe, expect, it } from 'vitest';
import { recordResult } from './progress';
import { defaultProgress } from './storage';

describe('recordResult', () => {
  it('updates rating, streak and history on a solve', () => {
    const p = recordResult(defaultProgress(), { id: 'x1', rating: 1300 }, true, 1);
    expect(p.glicko.rating).toBeGreaterThan(1200);
    expect(p.streak).toBe(1);
    expect(p.bestStreak).toBe(1);
    expect(p.solved).toBe(1);
    expect(p.attempted).toBe(1);
    expect(p.history[0]).toMatchObject({ id: 'x1', solved: true, puzzleRating: 1300, at: 1 });
    expect(p.history[0].delta).toBeGreaterThan(0);
    expect(p.recent).toEqual(['x1']);
  });

  it('resets the streak on a failure but keeps the best streak', () => {
    let p = defaultProgress();
    p = recordResult(p, { id: 'a', rating: 1200 }, true);
    p = recordResult(p, { id: 'b', rating: 1200 }, true);
    p = recordResult(p, { id: 'c', rating: 1200 }, false);
    expect(p.streak).toBe(0);
    expect(p.bestStreak).toBe(2);
    expect(p.history.map((h) => h.id)).toEqual(['c', 'b', 'a']);
    expect(p.history[0].delta).toBeLessThan(0);
  });

  it('does not mutate the input', () => {
    const p = defaultProgress();
    recordResult(p, { id: 'a', rating: 1200 }, true);
    expect(p).toEqual(defaultProgress());
  });
});

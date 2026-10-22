import { describe, expect, it } from 'vitest';
import { selectPuzzle } from './selector';
import type { Puzzle } from './puzzle';

const mk = (id: string, rating: number, themes: string[] = ['fork']): Puzzle => ({
  id,
  fen: '',
  moves: [],
  rating,
  themes,
});

const pool = [
  mk('a', 800),
  mk('b', 1180),
  mk('c', 1220, ['mate', 'mateIn1']),
  mk('d', 1250, ['pin']),
  mk('e', 1900, ['mate']),
  mk('f', 2400, ['endgame']),
];
const fixed = () => 0.5;

describe('selectPuzzle', () => {
  it('picks near the target rating', () => {
    for (let i = 0; i < 50; i++) {
      const p = selectPuzzle(pool, { rating: 1200, recent: new Set() })!;
      expect(['b', 'c', 'd']).toContain(p.id);
    }
  });

  it('skips recently played puzzles', () => {
    const p = selectPuzzle(pool, { rating: 1200, recent: new Set(['b', 'c']), random: fixed })!;
    expect(p.id).toBe('d');
  });

  it('widens the window when nothing unplayed is close', () => {
    const p = selectPuzzle(pool, { rating: 1200, recent: new Set(['b', 'c', 'd']), random: fixed })!;
    expect(p.id).toBe('a');
  });

  it('falls back to recent puzzles when everything was played', () => {
    const all = new Set(pool.map((p) => p.id));
    expect(selectPuzzle(pool, { rating: 1200, recent: all })).not.toBeNull();
  });

  it('filters by theme', () => {
    for (let i = 0; i < 20; i++) {
      const p = selectPuzzle(pool, { rating: 1200, recent: new Set(), themes: ['mate'] })!;
      expect(['c', 'e']).toContain(p.id);
    }
    const p = selectPuzzle(pool, { rating: 1200, recent: new Set(), themes: ['mate'], random: fixed })!;
    expect(p.id).toBe('c');
  });

  it('never returns an excluded puzzle and returns null on an empty pool', () => {
    const p = selectPuzzle(pool, { rating: 1200, recent: new Set(), themes: ['pin'], exclude: new Set(['d']) });
    expect(p).toBeNull();
    expect(selectPuzzle([], { rating: 1200, recent: new Set() })).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { gameEnd, isPromotion, legalDests } from './chessutil';

describe('gameEnd', () => {
  it('detects checkmate and the winner', () => {
    const c = new Chess();
    for (const m of ['f3', 'e5', 'g4', 'Qh4#']) c.move(m);
    expect(gameEnd(c)).toEqual({ kind: 'checkmate', winner: 'black' });
  });

  it('detects stalemate', () => {
    expect(gameEnd(new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'))).toEqual({ kind: 'stalemate' });
  });

  it('detects insufficient material', () => {
    expect(gameEnd(new Chess('8/8/4k3/8/8/2B5/4K3/8 w - - 0 1'))).toEqual({ kind: 'insufficient' });
  });

  it('detects threefold repetition', () => {
    const c = new Chess();
    for (let i = 0; i < 2; i++) for (const m of ['Nf3', 'Nf6', 'Ng1', 'Ng8']) c.move(m);
    expect(gameEnd(c)).toEqual({ kind: 'threefold' });
  });

  it('detects the fifty-move rule', () => {
    expect(gameEnd(new Chess('8/8/4k3/8/8/2R5/4K3/8 w - - 100 80'))).toEqual({ kind: 'fifty' });
  });

  it('returns null for a game in progress', () => {
    expect(gameEnd(new Chess())).toBeNull();
  });
});

describe('helpers', () => {
  it('lists legal destinations per square', () => {
    const d = legalDests(new Chess());
    expect(d.get('e2')?.sort()).toEqual(['e3', 'e4']);
    expect(d.get('g1')?.sort()).toEqual(['f3', 'h3']);
    expect(d.size).toBe(10);
  });

  it('recognises pawn promotions', () => {
    const c = new Chess('8/1P6/8/8/8/8/6p1/K6k w - - 0 1');
    expect(isPromotion(c, 'b7', 'b8')).toBe(true);
    expect(isPromotion(c, 'a1', 'b1')).toBe(false);
    expect(isPromotion(c, 'g2', 'g1')).toBe(true);
  });
});

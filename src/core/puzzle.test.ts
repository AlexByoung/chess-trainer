import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { PuzzleRunner, puzzleFromRow, type Puzzle } from './puzzle';
import { playUci } from './chessutil';

// Lichess puzzle 00008 (first row of the public database).
const multiStep = puzzleFromRow([
  '00008',
  'r6k/pp2r2p/4Rp1Q/3p4/8/1N1P2R1/PqP2bPP/7K b - - 0 24',
  'f2g3 e6e7 b2b1 b3c1 b1c1 h6c1',
  1913,
  'crushing hangingPiece long middlegame',
]);

// Back-rank mate in one: stored answer is Ra8#, but Rb8# mates as well.
const twoMates: Puzzle = {
  id: 'mate2ways',
  fen: '6k1/5ppp/2p5/8/8/8/5PPP/RR4K1 b - - 0 1',
  moves: ['c6c5', 'a1a8'],
  rating: 800,
  themes: ['mate', 'mateIn1', 'backRankMate'],
};

// Under-promotion fork: e8=N+ wins the queen, e8=Q does not.
const underPromotion: Puzzle = {
  id: 'knightfork',
  fen: '8/4P1k1/8/8/8/8/3q4/K7 b - - 0 1',
  moves: ['d2d6', 'e7e8n', 'g7f7', 'e8d6'],
  rating: 1500,
  themes: ['underPromotion', 'fork'],
};

const queenPromotion: Puzzle = {
  id: 'promote',
  fen: '8/1P6/8/8/8/7p/8/K6k b - - 0 1',
  moves: ['h3h2', 'b7b8q'],
  rating: 700,
  themes: ['promotion'],
};

describe('puzzle parsing', () => {
  it('splits the row into moves and themes', () => {
    expect(multiStep.moves).toEqual(['f2g3', 'e6e7', 'b2b1', 'b3c1', 'b1c1', 'h6c1']);
    expect(multiStep.themes).toEqual(['crushing', 'hangingPiece', 'long', 'middlegame']);
    expect(multiStep.rating).toBe(1913);
  });

  it('the player is the side NOT to move in the FEN; the first move is the opponent setup move', () => {
    const r = new PuzzleRunner(multiStep);
    expect(r.playerColor).toBe('white');
    expect(r.isPlayerTurn).toBe(false);
    const first = r.playOpening();
    expect(first.san).toBe('Bxg3');
    expect(r.chess.turn()).toBe('w');
    expect(r.isPlayerTurn).toBe(true);
    expect(r.expected).toBe('e6e7');
  });

  it('cannot replay the opening', () => {
    const r = new PuzzleRunner(multiStep);
    r.playOpening();
    expect(() => r.playOpening()).toThrow();
  });
});

describe('solving', () => {
  it('walks a multi-step solution with opponent replies', () => {
    const r = new PuzzleRunner(multiStep);
    r.playOpening();
    expect(r.attempt('e6e7').kind).toBe('continue');
    expect(r.isPlayerTurn).toBe(false);
    expect(r.opponentReply().san).toBe('Qb1+');
    expect(r.attempt('b3c1').kind).toBe('continue');
    expect(r.opponentReply().san).toBe('Qxc1+');
    const last = r.attempt('h6c1');
    expect(last.kind).toBe('solved');
    expect(r.solved).toBe(true);
    expect(r.failed).toBe(false);
    expect(r.finished).toBe(true);
  });

  it('rejects a wrong move, keeps the position and marks the puzzle failed', () => {
    const r = new PuzzleRunner(multiStep);
    r.playOpening();
    const before = r.chess.fen();
    const res = r.attempt('h6h7'); // legal (Qxh7+?? Kxh7) but not the solution
    expect(res.kind).toBe('wrong');
    expect(res.move?.san).toBe('Qxh7+');
    expect(r.chess.fen()).toBe(before);
    expect(r.failed).toBe(true);
    // Retrying with the right move still works, but the puzzle stays failed.
    expect(r.attempt('e6e7').kind).toBe('continue');
    expect(r.failed).toBe(true);
  });

  it('treats an illegal move as wrong without changing the position', () => {
    const r = new PuzzleRunner(multiStep);
    r.playOpening();
    const before = r.chess.fen();
    expect(r.attempt('a2a5')).toEqual({ kind: 'wrong', move: null });
    expect(r.chess.fen()).toBe(before);
  });

  it('accepts the stored mate', () => {
    const r = new PuzzleRunner(twoMates);
    r.playOpening();
    expect(r.attempt('a1a8').kind).toBe('solved');
  });

  it('accepts a different move that also checkmates', () => {
    const r = new PuzzleRunner(twoMates);
    r.playOpening();
    const res = r.attempt('b1b8');
    expect(res.kind).toBe('solved');
    expect(res.move?.san).toBe('Rb8#');
    expect(r.failed).toBe(false);
  });

  it('a non-mating alternative is still wrong', () => {
    const r = new PuzzleRunner(twoMates);
    r.playOpening();
    expect(r.attempt('b1b7').kind).toBe('wrong');
  });

  it('accepts an alternative mate in the middle of a longer line and ends the puzzle', () => {
    // Same back-rank pattern, but stored as a quiet first move followed by mate.
    const p: Puzzle = { ...twoMates, moves: ['c6c5', 'h2h3', 'c5c4', 'a1a8'] };
    const r = new PuzzleRunner(p);
    r.playOpening();
    expect(r.attempt('a1a8').kind).toBe('solved');
    expect(r.finished).toBe(true);
  });
});

describe('promotion puzzles', () => {
  it('requires the right promotion piece', () => {
    const r = new PuzzleRunner(queenPromotion);
    r.playOpening();
    expect(r.attempt('b7b8r').kind).toBe('wrong');
    expect(r.attempt('b7b8q').kind).toBe('solved');
  });

  it('handles an under-promotion fork', () => {
    const r = new PuzzleRunner(underPromotion);
    expect(r.playOpening().san).toBe('Qd6');
    expect(r.attempt('e7e8q').kind).toBe('wrong');
    const res = r.attempt('e7e8n');
    expect(res.kind).toBe('continue');
    expect(res.move?.san).toBe('e8=N+');
    expect(r.opponentReply().san).toBe('Kf7');
    expect(r.attempt('e8d6').kind).toBe('solved');
  });
});

describe('show solution', () => {
  it('plays the remaining line for both sides and marks the puzzle failed', () => {
    const r = new PuzzleRunner(multiStep);
    r.playOpening();
    const sans: string[] = [];
    let m;
    while ((m = r.playSolutionStep())) sans.push(m.san);
    expect(sans).toEqual(['Rxe7', 'Qb1+', 'Nc1', 'Qxc1+', 'Qxc1']);
    expect(r.failed).toBe(true);
    expect(r.finished).toBe(true);
  });
});

describe('playUci', () => {
  it('understands king-takes-rook castling notation', () => {
    const chess = new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    expect(playUci(chess, 'e1h1')?.san).toBe('O-O');
    expect(playUci(chess, 'e8a8')?.san).toBe('O-O-O');
  });
});

describe('resume', () => {
  it('replays to a saved ply so a reload continues mid-puzzle', () => {
    const r = new PuzzleRunner(multiStep);
    r.replayTo(3);
    expect(r.ply).toBe(3);
    expect(r.isPlayerTurn).toBe(true);
    expect(r.expected).toBe('b3c1');
    expect(r.failed).toBe(false);
    expect(r.attempt('b3c1').kind).toBe('continue');
  });

  it('replaying the whole line marks it solved', () => {
    const r = new PuzzleRunner(multiStep);
    r.replayTo(6);
    expect(r.finished).toBe(true);
  });
});

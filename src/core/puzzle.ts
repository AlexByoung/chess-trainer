import { Chess, type Move } from 'chess.js';
import { moveToUci, playUci, type Color } from './chessutil';

export interface Puzzle {
  id: string;
  /** Position before the opponent's setup move. */
  fen: string;
  /** UCI moves; moves[0] is the opponent's, then player / opponent alternate. */
  moves: string[];
  rating: number;
  themes: string[];
}

export type PuzzleRow = [id: string, fen: string, moves: string, rating: number, themes: string];

export function puzzleFromRow([id, fen, moves, rating, themes]: PuzzleRow): Puzzle {
  return { id, fen, moves: moves.split(' '), rating, themes: themes ? themes.split(' ') : [] };
}

export type AttemptResult =
  /** Correct, the opponent replies next (call `opponentReply`). */
  | { kind: 'continue'; move: Move }
  /** Correct and the puzzle is finished. */
  | { kind: 'solved'; move: Move }
  /** Wrong (or illegal); the position is unchanged. */
  | { kind: 'wrong'; move: Move | null };

/**
 * Pure puzzle state machine, independent of any UI.
 *
 *   const r = new PuzzleRunner(p);
 *   r.playOpening();          // opponent's first move (moves[0])
 *   r.attempt('e2e4');        // player's move → continue / solved / wrong
 *   r.opponentReply();        // after 'continue'
 */
export class PuzzleRunner {
  readonly chess: Chess;
  readonly playerColor: Color;
  /** Index into puzzle.moves of the next move to be played. */
  ply = 0;
  /** Set once the player made a mistake or asked for help: the puzzle no longer counts. */
  failed = false;
  solved = false;

  constructor(readonly puzzle: Puzzle) {
    this.chess = new Chess(puzzle.fen);
    // The FEN's side to move plays the setup move; the player is the other side.
    this.playerColor = this.chess.turn() === 'w' ? 'black' : 'white';
  }

  get finished(): boolean {
    return this.solved || this.ply >= this.puzzle.moves.length;
  }

  get isPlayerTurn(): boolean {
    return !this.finished && this.ply % 2 === 1;
  }

  get expected(): string | undefined {
    return this.puzzle.moves[this.ply];
  }

  playOpening(): Move {
    if (this.ply !== 0) throw new Error('opening already played');
    return this.advance();
  }

  attempt(uci: string): AttemptResult {
    if (!this.isPlayerTurn) throw new Error('not the player turn');
    const move = playUci(this.chess, uci);
    if (!move) return { kind: 'wrong', move: null };

    const expected = this.expected!;
    const matches = moveToUci(move) === expected || sameMove(move, expected, this.chess);
    // As on Lichess: any move that mates is a solution, even if it isn't the stored one.
    if (matches || this.chess.isCheckmate()) {
      this.ply++;
      if (this.chess.isCheckmate() || this.ply >= this.puzzle.moves.length) {
        this.solved = true;
        return { kind: 'solved', move };
      }
      return { kind: 'continue', move };
    }
    this.chess.undo();
    this.failed = true;
    return { kind: 'wrong', move };
  }

  opponentReply(): Move {
    if (this.finished || this.ply % 2 !== 0) throw new Error('not the opponent turn');
    return this.advance();
  }

  /** Plays the next stored solution move for whichever side is to move ("show answer"). */
  playSolutionStep(): Move | null {
    if (this.finished) return null;
    if (this.ply % 2 === 1) this.failed = true;
    const move = this.advance();
    if (this.ply >= this.puzzle.moves.length) this.solved = true;
    return move;
  }

  /** Fast-forwards to `ply` without judging (used to resume a puzzle after reload). */
  replayTo(ply: number): void {
    while (this.ply < Math.min(ply, this.puzzle.moves.length)) this.advance();
    if (this.ply >= this.puzzle.moves.length) this.solved = true;
  }

  markFailed(): void {
    this.failed = true;
  }

  private advance(): Move {
    const uci = this.puzzle.moves[this.ply];
    const move = playUci(this.chess, uci);
    if (!move) throw new Error(`illegal stored move ${uci} in puzzle ${this.puzzle.id}`);
    this.ply++;
    return move;
  }
}

/**
 * The stored move may use the king-takes-rook castling form; compare by playing it
 * on a copy of the pre-move position.
 */
function sameMove(played: Move, expectedUci: string, after: Chess): boolean {
  const probe = new Chess(played.before);
  const exp = playUci(probe, expectedUci);
  return !!exp && exp.san === played.san && after.fen() === probe.fen();
}

import type { Move } from 'chess.js';
import type { Key } from 'chessground/types';
import { PuzzleRunner, type Puzzle } from '../core/puzzle';
import type { Board } from './board';
import { moveSound, play } from './sound';

export type PlayerPhase = 'idle' | 'opening' | 'player' | 'opponent' | 'replay' | 'done';

export interface PuzzleHooks {
  /** Phase changed (to refresh status text / buttons). */
  phase(p: PlayerPhase): void;
  /** A correct player move or opponent reply was played (to persist progress). */
  progressed?(ply: number): void;
  /** The player's move was wrong. `first` is true for the first mistake in this puzzle. */
  wrong(first: boolean): void;
  /** The puzzle is finished. `clean` = solved without mistakes or help. */
  solved(clean: boolean): void;
}

export interface PuzzlePlayerOptions {
  /** Opponent reply delay range in ms. */
  replyDelay: [number, number];
  /** In storm mode a wrong move ends the puzzle instead of allowing a retry. */
  retryOnWrong: boolean;
}

/** Drives one puzzle on the shared board: setup animation, judging, replies, hints. */
export class PuzzlePlayer {
  runner: PuzzleRunner | null = null;
  phase: PlayerPhase = 'idle';
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private hintLevel = 0;
  private lastMove: [string, string] | null = null;

  constructor(
    private board: Board,
    private hooks: PuzzleHooks,
    private opts: PuzzlePlayerOptions,
  ) {}

  get puzzle(): Puzzle | null {
    return this.runner?.puzzle ?? null;
  }

  /** Shows `puzzle`; resumes at `resumePly` (no setup animation) when given. */
  load(puzzle: Puzzle, resume?: { ply: number; failed: boolean }) {
    this.stop();
    const r = new PuzzleRunner(puzzle);
    this.runner = r;
    this.hintLevel = 0;
    this.lastMove = null;
    this.board.shapes([]);
    this.board.setOrientation(r.playerColor);
    if (resume && resume.ply > 0) {
      r.replayTo(resume.ply);
      if (resume.failed) r.markFailed();
      const last = r.chess.history({ verbose: true }).at(-1);
      this.lastMove = last ? [last.from, last.to] : null;
      if (r.finished) return this.setPhase('done');
      if (r.isPlayerTurn) return this.setPhase('player');
      this.setPhase('opponent');
      this.later(this.replyDelay(), () => this.reply());
      return;
    }
    this.setPhase('opening');
    this.later(450, () => {
      const m = r.playOpening();
      this.afterMove(m);
      this.hooks.progressed?.(r.ply);
      this.setPhase('player');
    });
  }

  /** Board callback: the user played `uci`. */
  userMove(uci: string) {
    const r = this.runner;
    if (!r || this.phase !== 'player') return this.render();
    this.board.shapes([]);
    const wasFailed = r.failed;
    const res = r.attempt(uci);
    if (res.kind === 'wrong') {
      play('error');
      // Leave the wrong move on the board for a moment (shake + red mark), then take it back.
      this.board.wrong(uci.slice(2, 4));
      this.board.cg.set({ movable: { dests: new Map() } });
      this.setPhase(this.opts.retryOnWrong ? 'opponent' : 'done', false);
      this.hooks.wrong(!wasFailed);
      if (this.opts.retryOnWrong) {
        this.later(480, () => {
          this.board.shapes([]);
          this.setPhase('player');
        });
      }
      return;
    }
    this.afterMove(res.move);
    this.hooks.progressed?.(r.ply);
    if (res.kind === 'solved') {
      this.finish();
      return;
    }
    this.setPhase('opponent');
    this.later(this.replyDelay(), () => this.reply());
  }

  /** First press: highlight the piece to move. Second: show the move. */
  hint(): boolean {
    const r = this.runner;
    if (!r || this.phase !== 'player' || !r.expected) return false;
    r.markFailed();
    const uci = r.expected;
    if (this.hintLevel === 0) this.board.shapes([{ orig: uci.slice(0, 2) as Key, brush: 'blue' }]);
    else this.board.arrow(uci, 'blue');
    this.hintLevel = Math.min(1, this.hintLevel + 1);
    return true;
  }

  /** Plays the rest of the solution step by step. */
  showSolution(): boolean {
    const r = this.runner;
    if (!r || r.finished || this.phase === 'replay' || this.phase === 'opening') return false;
    this.stop();
    r.markFailed();
    this.board.shapes([]);
    this.setPhase('replay');
    const step = () => {
      const m = r.playSolutionStep();
      if (!m) return this.finish();
      this.afterMove(m);
      this.hooks.progressed?.(r.ply);
      if (r.finished) this.finish();
      else this.later(700, step);
    };
    this.later(250, step);
    return true;
  }

  stop() {
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
  }

  /** Re-syncs the board with the current position and phase. */
  render() {
    const r = this.runner;
    if (!r) return;
    this.board.sync(r.chess, {
      orientation: this.board.orientation,
      playerColor: r.playerColor,
      interactive: this.phase === 'player',
      lastMove: this.lastMove,
    });
  }

  private reply() {
    const r = this.runner!;
    const m = r.opponentReply();
    this.afterMove(m);
    this.hooks.progressed?.(r.ply);
    if (r.finished) this.finish();
    else this.setPhase('player');
  }

  private finish() {
    const r = this.runner!;
    const last = r.chess.history({ verbose: true }).at(-1);
    this.setPhase('done');
    if (last) this.board.success(last.to);
    if (!r.failed) play('success');
    this.hooks.solved(!r.failed);
  }

  private afterMove(m: Move) {
    this.lastMove = [m.from, m.to];
    this.hintLevel = 0;
    play(moveSound(m));
    this.render();
  }

  private setPhase(p: PlayerPhase, render = true) {
    this.phase = p;
    if (render) this.render();
    this.hooks.phase(p);
  }

  private replyDelay(): number {
    const [a, b] = this.opts.replyDelay;
    return a + Math.random() * (b - a);
  }

  private later(ms: number, fn: () => void) {
    const t = setTimeout(() => {
      this.timers.delete(t);
      fn();
    }, ms);
    this.timers.add(t);
  }
}

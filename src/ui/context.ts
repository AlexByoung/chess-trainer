import type { Puzzle } from '../core/puzzle';
import type { Settings } from '../core/storage';
import type { Board } from './board';

export interface PuzzleDb {
  list: Puzzle[];
  byId: Map<string, Puzzle>;
}

export interface Modal {
  open(content: HTMLElement, opts?: { dismissible?: boolean }): void;
  close(): void;
}

export interface EvalBar {
  show(on: boolean): void;
  /** Score from White's point of view. */
  set(score: { cp?: number; mate?: number } | null): void;
  /** Redraws the last score (e.g. after the board was flipped). */
  refresh(): void;
}

/** Shared services handed to every view. */
export interface Ctx {
  board: Board;
  panel: HTMLElement;
  settings: Settings;
  updateSettings(patch: Partial<Settings>): void;
  puzzles(): Promise<PuzzleDb>;
  evalBar: EvalBar;
  modal: Modal;
}

export interface View {
  mount(): void;
  unmount(): void;
  onUserMove(uci: string): void;
  /** Handles a keyboard shortcut; returns true when consumed. */
  onKey(key: string): boolean;
}

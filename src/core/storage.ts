import { INITIAL, type Glicko } from './rating';

/** Everything persisted lives under these localStorage keys. */
const KEYS = {
  settings: 'ct.settings.v1',
  puzzles: 'ct.puzzles.v1',
  game: 'ct.game.v1',
  storm: 'ct.storm.v1',
  view: 'ct.view.v1',
} as const;

export type ThemeMode = 'system' | 'light' | 'dark';
export type BoardTheme = 'green' | 'brown' | 'blue';
export type View = 'puzzle' | 'storm' | 'game';

export interface Settings {
  theme: ThemeMode;
  board: BoardTheme;
  sound: boolean;
  autoNext: boolean;
  showEval: boolean;
  themeFilter: string;
}

export interface HistoryEntry {
  id: string;
  puzzleRating: number;
  solved: boolean;
  /** Player rating after this puzzle. */
  rating: number;
  delta: number;
  at: number;
}

/** Puzzle currently on screen, so a reload resumes it mid-line. */
export interface CurrentPuzzle {
  id: string;
  /** Number of solution moves already played (including the opponent's setup move). */
  ply: number;
  failed: boolean;
  /** Rating result already recorded for this puzzle. */
  recorded: boolean;
}

export interface PuzzleProgress {
  glicko: Glicko;
  streak: number;
  bestStreak: number;
  solved: number;
  attempted: number;
  history: HistoryEntry[];
  /** Most recent first. */
  recent: string[];
  current: CurrentPuzzle | null;
}

export interface SavedGame {
  /** What the player picked on the new-game screen ("再来一局" reuses it). */
  choice: 'white' | 'black' | 'random';
  playerColor: 'white' | 'black';
  level: number;
  orientation: 'white' | 'black';
  /** UCI moves from the standard start position. */
  moves: string[];
  result: string | null;
}

export interface StormRecord {
  best: number;
  runs: number;
}

export const HISTORY_LIMIT = 500;
export const RECENT_LIMIT = 1500;

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  board: 'green',
  sound: true,
  autoNext: true,
  showEval: false,
  themeFilter: 'all',
};

export function defaultProgress(): PuzzleProgress {
  return {
    glicko: { ...INITIAL },
    streak: 0,
    bestStreak: 0,
    solved: 0,
    attempted: 0,
    history: [],
    recent: [],
    current: null,
  };
}

function read<T>(key: string, fallback: () => T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback();
    const parsed = JSON.parse(raw);
    const base = fallback();
    // Merge so fields added in later versions get their defaults.
    return base && typeof base === 'object' && !Array.isArray(base) ? { ...base, ...parsed } : parsed;
  } catch {
    return fallback();
  }
}

function write(key: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or disabled (private mode): the app keeps working, just without persistence.
  }
}

export const store = {
  loadSettings: () => read<Settings>(KEYS.settings, () => ({ ...DEFAULT_SETTINGS })),
  saveSettings: (s: Settings) => write(KEYS.settings, s),
  loadProgress: () => read<PuzzleProgress>(KEYS.puzzles, defaultProgress),
  saveProgress: (p: PuzzleProgress) => write(KEYS.puzzles, p),
  loadGame: () => read<SavedGame | null>(KEYS.game, () => null),
  saveGame: (g: SavedGame | null) => write(KEYS.game, g),
  loadStorm: () => read<StormRecord>(KEYS.storm, () => ({ best: 0, runs: 0 })),
  saveStorm: (s: StormRecord) => write(KEYS.storm, s),
  loadView: (): View => {
    const v = read<string>(KEYS.view, () => 'puzzle');
    return v === 'game' || v === 'storm' ? v : 'puzzle';
  },
  saveView: (v: View) => write(KEYS.view, v),
};

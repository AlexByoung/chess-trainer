import { updateForPuzzle } from './rating';
import { HISTORY_LIMIT, RECENT_LIMIT, type PuzzleProgress } from './storage';

/** Applies one finished puzzle to the player's progress (rating, streak, history). */
export function recordResult(
  p: PuzzleProgress,
  puzzle: { id: string; rating: number },
  solved: boolean,
  now = Date.now(),
): PuzzleProgress {
  const glicko = updateForPuzzle(p.glicko, puzzle.rating, solved);
  const streak = solved ? p.streak + 1 : 0;
  const entry = {
    id: puzzle.id,
    puzzleRating: puzzle.rating,
    solved,
    rating: Math.round(glicko.rating),
    delta: Math.round(glicko.rating) - Math.round(p.glicko.rating),
    at: now,
  };
  return {
    ...p,
    glicko,
    streak,
    bestStreak: Math.max(p.bestStreak, streak),
    solved: p.solved + (solved ? 1 : 0),
    attempted: p.attempted + 1,
    history: [entry, ...p.history].slice(0, HISTORY_LIMIT),
    recent: rememberRecent(p.recent, puzzle.id),
  };
}

export function rememberRecent(recent: readonly string[], id: string): string[] {
  return [id, ...recent.filter((r) => r !== id)].slice(0, RECENT_LIMIT);
}

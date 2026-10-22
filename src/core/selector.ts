import type { Puzzle } from './puzzle';

export interface SelectOptions {
  /** Target rating (usually the player's current rating). */
  rating: number;
  /** Puzzle ids to avoid (recently played). */
  recent: ReadonlySet<string>;
  /** Only puzzles carrying one of these Lichess theme keys; empty = all. */
  themes?: readonly string[];
  /** Ids that must not be chosen at all (e.g. the puzzle on screen). */
  exclude?: ReadonlySet<string>;
  random?: () => number;
}

const WINDOWS = [75, 150, 250, 400, 700, 3000];

/**
 * Picks a puzzle close to `rating`: try a narrow band first and widen it until
 * something unplayed matches. Falls back to recently-played puzzles only when
 * the filtered pool is exhausted.
 */
export function selectPuzzle(pool: readonly Puzzle[], opts: SelectOptions): Puzzle | null {
  const random = opts.random ?? Math.random;
  const themes = opts.themes ?? [];
  const exclude = opts.exclude ?? new Set<string>();
  const matching = pool.filter(
    (p) => !exclude.has(p.id) && (themes.length === 0 || p.themes.some((t) => themes.includes(t))),
  );
  if (matching.length === 0) return null;

  // A little jitter around the target keeps the sequence from feeling mechanical.
  const target = opts.rating + (random() - 0.5) * 100;
  for (const avoidRecent of [true, false]) {
    const candidates = avoidRecent ? matching.filter((p) => !opts.recent.has(p.id)) : matching;
    for (const w of WINDOWS) {
      const band = candidates.filter((p) => Math.abs(p.rating - target) <= w);
      if (band.length > 0) return band[Math.floor(random() * band.length)];
    }
  }
  return null;
}

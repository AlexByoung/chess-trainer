/**
 * AI strength levels. Low levels use Skill Level (Stockfish deliberately picks a
 * weaker move among its top candidates) plus a shallow search; high levels use
 * the calibrated UCI_LimitStrength / UCI_Elo. Ratings are rough, Lichess-ish.
 */
export interface Level {
  id: number;
  name: string;
  elo: number;
  skill?: number;
  limitElo?: number;
  depth?: number;
  movetime: number;
}

export const LEVELS: Level[] = [
  { id: 1, name: '入门', elo: 800, skill: 0, depth: 1, movetime: 60 },
  { id: 2, name: '初级', elo: 1100, skill: 3, depth: 3, movetime: 120 },
  { id: 3, name: '中级', elo: 1400, skill: 6, depth: 5, movetime: 200 },
  { id: 4, name: '进阶', elo: 1700, skill: 10, depth: 8, movetime: 350 },
  { id: 5, name: '高手', elo: 2000, limitElo: 2000, movetime: 600 },
  { id: 6, name: '大师', elo: 2400, limitElo: 2400, movetime: 1000 },
];

export function levelById(id: number): Level {
  return LEVELS.find((l) => l.id === id) ?? LEVELS[2];
}

/** UCI setoption commands that put the engine at this level. */
export function levelOptions(level: Level): string[] {
  if (level.limitElo) {
    return [
      'setoption name Skill Level value 20',
      'setoption name UCI_LimitStrength value true',
      `setoption name UCI_Elo value ${level.limitElo}`,
    ];
  }
  return ['setoption name UCI_LimitStrength value false', `setoption name Skill Level value ${level.skill ?? 20}`];
}

export const FULL_STRENGTH = ['setoption name UCI_LimitStrength value false', 'setoption name Skill Level value 20'];

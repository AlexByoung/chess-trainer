/**
 * Glicko-2 (Glickman, "Example of the Glicko-2 system"), applied one puzzle at a
 * time: the player "plays" the puzzle, whose rating/deviation come from Lichess.
 */

export interface Glicko {
  rating: number;
  rd: number;
  vol: number;
}

export interface Opponent {
  rating: number;
  rd: number;
  /** 1 = win, 0 = loss, 0.5 = draw. */
  score: number;
}

const SCALE = 173.7178;
const TAU = 0.5;
const EPS = 0.000001;

export const INITIAL: Glicko = { rating: 1200, rd: 350, vol: 0.06 };
/** Keep the rating responsive even after many puzzles (Lichess does the same). */
export const MIN_RD = 60;
export const MAX_RD = 350;
/** Deviation assumed for bundled puzzles (they're filtered to well-established ones). */
export const PUZZLE_RD = 75;

const g = (phi: number) => 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
const expectation = (mu: number, muJ: number, phiJ: number) => 1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)));

/** Full Glicko-2 rating-period update against several opponents. */
export function glicko2(player: Glicko, games: Opponent[]): Glicko {
  const mu = (player.rating - 1500) / SCALE;
  const phi = player.rd / SCALE;
  const sigma = player.vol;

  if (games.length === 0) {
    const phiStar = Math.sqrt(phi * phi + sigma * sigma);
    return { rating: player.rating, rd: phiStar * SCALE, vol: sigma };
  }

  let vInv = 0;
  let deltaSum = 0;
  for (const o of games) {
    const muJ = (o.rating - 1500) / SCALE;
    const phiJ = o.rd / SCALE;
    const e = expectation(mu, muJ, phiJ);
    vInv += g(phiJ) ** 2 * e * (1 - e);
    deltaSum += g(phiJ) * (o.score - e);
  }
  const v = 1 / vInv;
  const delta = v * deltaSum;

  // Volatility via the Illinois algorithm (step 5 of the paper).
  const a = Math.log(sigma * sigma);
  const f = (x: number) => {
    const ex = Math.exp(x);
    return (ex * (delta * delta - phi * phi - v - ex)) / (2 * (phi * phi + v + ex) ** 2) - (x - a) / (TAU * TAU);
  };
  let A = a;
  let B: number;
  if (delta * delta > phi * phi + v) {
    B = Math.log(delta * delta - phi * phi - v);
  } else {
    let k = 1;
    while (f(a - k * TAU) < 0) k++;
    B = a - k * TAU;
  }
  let fA = f(A);
  let fB = f(B);
  while (Math.abs(B - A) > EPS) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else {
      fA /= 2;
    }
    B = C;
    fB = fC;
  }
  const sigmaNew = Math.exp(A / 2);

  const phiStar = Math.sqrt(phi * phi + sigmaNew * sigmaNew);
  const phiNew = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const muNew = mu + phiNew * phiNew * deltaSum;
  return { rating: muNew * SCALE + 1500, rd: phiNew * SCALE, vol: sigmaNew };
}

/** One puzzle result → new player rating (RD clamped, volatility kept sane). */
export function updateForPuzzle(player: Glicko, puzzleRating: number, solved: boolean): Glicko {
  const next = glicko2(player, [{ rating: puzzleRating, rd: PUZZLE_RD, score: solved ? 1 : 0 }]);
  return {
    rating: Math.max(400, Math.min(3200, next.rating)),
    rd: Math.max(MIN_RD, Math.min(MAX_RD, next.rd)),
    vol: Math.min(0.1, next.vol),
  };
}

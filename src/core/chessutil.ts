import { Chess, type Move, type Square } from 'chess.js';

export type Color = 'white' | 'black';

export interface UciParts {
  from: Square;
  to: Square;
  promotion?: string;
}

export function parseUci(uci: string): UciParts {
  return {
    from: uci.slice(0, 2) as Square,
    to: uci.slice(2, 4) as Square,
    promotion: uci.length > 4 ? uci[4] : undefined,
  };
}

export function moveToUci(m: Pick<Move, 'from' | 'to' | 'promotion'>): string {
  return m.from + m.to + (m.promotion ?? '');
}

/**
 * Plays a UCI move on `chess`. Accepts the "king takes own rook" castling form
 * (e1h1) as well as the standard e1g1. Returns null when the move is illegal.
 */
export function playUci(chess: Chess, uci: string): Move | null {
  const { from, to, promotion } = parseUci(uci);
  try {
    return chess.move({ from, to, promotion });
  } catch {
    const piece = chess.get(from);
    const target = chess.get(to);
    if (piece?.type === 'k' && target?.type === 'r' && target.color === piece.color) {
      const file = to[0] > from[0] ? 'g' : 'c';
      try {
        return chess.move({ from, to: (file + from[1]) as Square });
      } catch {
        return null;
      }
    }
    return null;
  }
}

/** Legal destinations in the shape chessground expects. */
export function legalDests(chess: Chess): Map<Square, Square[]> {
  const dests = new Map<Square, Square[]>();
  for (const m of chess.moves({ verbose: true })) {
    const list = dests.get(m.from);
    if (list) list.push(m.to);
    else dests.set(m.from, [m.to]);
  }
  return dests;
}

export function turnColor(chess: Chess): Color {
  return chess.turn() === 'w' ? 'white' : 'black';
}

export function opposite(c: Color): Color {
  return c === 'white' ? 'black' : 'white';
}

/** True when moving from→to is a pawn reaching the last rank (needs a promotion choice). */
export function isPromotion(chess: Chess, from: Square, to: Square): boolean {
  const p = chess.get(from);
  return !!p && p.type === 'p' && (to[1] === '8' || to[1] === '1');
}

export type GameEnd =
  | { kind: 'checkmate'; winner: Color }
  | { kind: 'stalemate' | 'threefold' | 'fifty' | 'insufficient' };

export function gameEnd(chess: Chess): GameEnd | null {
  if (chess.isCheckmate()) return { kind: 'checkmate', winner: opposite(turnColor(chess)) };
  if (chess.isStalemate()) return { kind: 'stalemate' };
  if (chess.isInsufficientMaterial()) return { kind: 'insufficient' };
  if (chess.isThreefoldRepetition()) return { kind: 'threefold' };
  if (chess.isDrawByFiftyMoves()) return { kind: 'fifty' };
  return null;
}

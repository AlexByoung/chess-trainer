import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { DrawShape } from 'chessground/draw';
import type { Key } from 'chessground/types';
import type { Chess, Square } from 'chess.js';
import { isPromotion, legalDests, turnColor, type Color } from '../core/chessutil';

export type UserMoveHandler = (uci: string) => void;

const ROLES = [
  ['q', 'queen'],
  ['n', 'knight'],
  ['r', 'rook'],
  ['b', 'bishop'],
] as const;

/**
 * Chessground wrapper: renders a chess.js position, reports user moves as UCI
 * (asking for the promotion piece when needed) and offers small effects.
 */
export class Board {
  readonly cg: Api;
  private promo: HTMLElement | null = null;
  private chess: Chess | null = null;
  /** Bumped on every sync so a pending promotion choice for an old position is ignored. */
  private version = 0;

  constructor(
    readonly el: HTMLElement,
    private onMove: UserMoveHandler,
  ) {
    this.cg = Chessground(el, {
      coordinates: true,
      animation: { enabled: true, duration: 220 },
      highlight: { lastMove: true, check: true },
      movable: { free: false, showDests: true, events: { after: (o, d) => this.handleMove(o, d) } },
      premovable: { enabled: false },
      draggable: { enabled: true, showGhost: true, distance: 3 },
      selectable: { enabled: true },
      drawable: { enabled: false, visible: true },
      disableContextMenu: true,
    });
  }

  /**
   * Shows `chess`'s position. `playerColor` may move when it is their turn and
   * `interactive` is true.
   */
  sync(chess: Chess, o: { orientation: Color; playerColor: Color; interactive: boolean; lastMove?: [string, string] | null }) {
    this.version++;
    this.chess = chess;
    this.closePromotion();
    const turn = turnColor(chess);
    const canMove = o.interactive && turn === o.playerColor;
    this.cg.set({
      fen: chess.fen(),
      orientation: o.orientation,
      turnColor: turn,
      check: chess.inCheck(),
      lastMove: o.lastMove ? (o.lastMove as Key[]) : undefined, // undefined clears it
      movable: { color: o.playerColor, dests: canMove ? (legalDests(chess) as Map<Key, Key[]>) : new Map() },
    });
    this.cg.cancelMove();
  }

  setOrientation(c: Color) {
    this.cg.set({ orientation: c });
  }

  toggleOrientation() {
    this.cg.toggleOrientation();
  }

  get orientation(): Color {
    return this.cg.state.orientation;
  }

  shapes(shapes: DrawShape[]) {
    this.cg.setAutoShapes(shapes);
  }

  arrow(uci: string, brush = 'green') {
    this.shapes([{ orig: uci.slice(0, 2) as Key, dest: uci.slice(2, 4) as Key, brush }]);
  }

  /** Red mark on the square of the wrong move. */
  wrong(square: string) {
    this.shapes([{ orig: square as Key, brush: 'red' }]);
  }

  success(square: string) {
    this.shapes([{ orig: square as Key, brush: 'green' }]);
  }

  redraw() {
    this.cg.redrawAll();
  }

  private handleMove(orig: Key, dest: Key) {
    const chess = this.chess;
    if (chess && isPromotion(chess, orig as Square, dest as Square)) {
      const v = this.version;
      this.askPromotion(dest, turnColor(chess)).then((role) => {
        if (v !== this.version) return;
        if (!role) {
          // Cancelled: put the pawn back.
          this.cg.set({ fen: chess.fen() });
          this.cg.set({ movable: { dests: legalDests(chess) as Map<Key, Key[]> } });
          return;
        }
        this.onMove(orig + dest + role);
      });
      return;
    }
    this.onMove(orig + dest);
  }

  private askPromotion(dest: Key, color: Color): Promise<string | null> {
    this.closePromotion();
    return new Promise((resolve) => {
      const white = this.cg.state.orientation === 'white';
      const file = dest.charCodeAt(0) - 97;
      const rank = Number(dest[1]);
      const col = white ? file : 7 - file;
      const row = white ? 8 - rank : rank - 1;
      const dir = row === 0 ? 1 : -1;

      const overlay = document.createElement('div');
      overlay.className = 'promotion';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-label', '选择升变棋子');
      const done = (r: string | null) => {
        this.closePromotion();
        resolve(r);
      };
      overlay.addEventListener('pointerdown', (e) => {
        if (e.target === overlay) {
          e.preventDefault();
          done(null);
        }
      });
      ROLES.forEach(([letter, role], i) => {
        const sq = document.createElement('button');
        sq.className = 'promo-choice';
        sq.dataset.role = letter;
        sq.setAttribute('aria-label', { q: '后', n: '马', r: '车', b: '象' }[letter]);
        sq.style.left = `${col * 12.5}%`;
        sq.style.top = `${(row + dir * i) * 12.5}%`;
        const piece = document.createElement('piece');
        piece.className = `${role} ${color}`;
        sq.appendChild(piece);
        sq.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          done(letter);
        });
        overlay.appendChild(sq);
      });
      this.cg.state.dom.elements.wrap.appendChild(overlay);
      this.promo = overlay;
    });
  }

  private closePromotion() {
    this.promo?.remove();
    this.promo = null;
  }
}

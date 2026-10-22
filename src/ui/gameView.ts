import { Chess } from 'chess.js';
import { gameEnd, moveToUci, playUci, turnColor, type Color, type GameEnd } from '../core/chessutil';
import { FULL_STRENGTH, LEVELS, levelById, levelOptions } from '../core/levels';
import { store, type SavedGame } from '../core/storage';
import { engine } from '../engine/engine';
import type { Ctx, View } from './context';
import { h } from './dom';
import { moveSound, play } from './sound';

const END_REASON: Record<GameEnd['kind'], string> = {
  checkmate: '将杀',
  stalemate: '逼和',
  threefold: '三次重复局面',
  fifty: '50 步规则',
  insufficient: '子力不足',
};

/** Full game against Stockfish with selectable strength; auto-saved after every move. */
export class GameView implements View {
  private game: SavedGame | null = store.loadGame();
  private chess = new Chess();
  private thinking = false;
  /** Bumped by anything that invalidates a pending engine answer (undo, new game, leaving). */
  private token = 0;
  private engineReady = false;
  private els!: {
    opponent: HTMLElement;
    status: HTMLElement;
    moves: HTMLElement;
    undo: HTMLButtonElement;
    hint: HTMLButtonElement;
    evalToggle: HTMLInputElement;
  };

  constructor(private ctx: Ctx) {}

  mount() {
    this.buildPanel();
    this.ctx.evalBar.show(this.ctx.settings.showEval);
    this.ctx.evalBar.set(null);
    engine.init().then(
      () => {
        this.engineReady = true;
        this.refreshStatus();
      },
      (e) => this.setStatus(`引擎加载失败：${e instanceof Error ? e.message : e}`, 'bad'),
    );
    if (this.game) {
      this.chess = new Chess();
      for (const m of this.game.moves) playUci(this.chess, m);
      this.render();
      this.continueGame();
    } else {
      this.render();
      this.openNewGame(false);
    }
  }

  unmount() {
    this.token++;
    engine.cancel();
    this.thinking = false;
  }

  onUserMove(uci: string) {
    const g = this.game;
    if (!g || g.result || this.thinking || turnColor(this.chess) !== g.playerColor) return this.render();
    const m = playUci(this.chess, uci);
    if (!m) return this.render();
    g.moves.push(moveToUci(m));
    this.save();
    play(moveSound(m));
    this.ctx.board.shapes([]);
    this.render();
    if (!this.checkEnd()) this.aiMove();
  }

  onKey(key: string): boolean {
    switch (key.toLowerCase()) {
      case 'u':
        this.undo();
        return true;
      case 'h':
        this.hint();
        return true;
      case 'f':
        this.flip();
        return true;
    }
    return false;
  }

  // ---- game flow --------------------------------------------------------

  private newGame(choice: SavedGame['choice'], level: number) {
    this.token++;
    engine.cancel();
    engine.newGame();
    this.thinking = false;
    const playerColor: Color = choice === 'random' ? (Math.random() < 0.5 ? 'white' : 'black') : choice;
    this.game = { choice, playerColor, level, orientation: playerColor, moves: [], result: null };
    this.chess = new Chess();
    this.ctx.modal.close();
    this.ctx.evalBar.set(null);
    this.save();
    this.render();
    this.continueGame();
  }

  /** After loading/undo: let the AI move if it's its turn, otherwise refresh eval. */
  private continueGame() {
    const g = this.game;
    if (!g) return;
    if (g.result) return this.refreshStatus();
    if (this.checkEnd()) return;
    if (turnColor(this.chess) !== g.playerColor) this.aiMove();
    else {
      this.refreshStatus();
      this.updateEval();
    }
  }

  private async aiMove() {
    const g = this.game!;
    const token = ++this.token;
    this.thinking = true;
    this.refreshStatus();
    const level = levelById(g.level);
    const started = performance.now();
    const res = await engine.search({
      moves: g.moves,
      options: levelOptions(level),
      movetime: level.movetime,
      depth: level.depth,
    });
    if (token !== this.token || !res.bestmove) return;
    // A short pause so the reply feels like a person moving, not an instant snap.
    const wait = 450 + Math.random() * 400 - (performance.now() - started);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    if (token !== this.token) return;
    const m = playUci(this.chess, res.bestmove);
    this.thinking = false;
    if (!m) return this.render();
    g.moves.push(moveToUci(m));
    this.save();
    play(moveSound(m));
    this.render();
    if (!this.checkEnd()) {
      this.refreshStatus();
      this.updateEval();
    }
  }

  private checkEnd(): boolean {
    const g = this.game!;
    const end = gameEnd(this.chess);
    if (!end) return false;
    const reason = END_REASON[end.kind];
    const title = end.kind === 'checkmate' ? (end.winner === g.playerColor ? '你赢了' : '你输了') : '和棋';
    g.result = `${title} · ${reason}`;
    this.thinking = false;
    this.save();
    this.render();
    this.refreshStatus();
    this.updateEval();
    play('end');
    this.showResult(title, reason);
    return true;
  }

  private undo() {
    const g = this.game;
    if (!g || g.moves.length === 0) return;
    this.token++;
    engine.cancel();
    this.thinking = false;
    // Take back to the player's previous turn (their move + the AI's reply).
    this.chess.undo();
    g.moves.pop();
    while (g.moves.length && turnColor(this.chess) !== g.playerColor) {
      this.chess.undo();
      g.moves.pop();
    }
    g.result = null;
    this.save();
    this.ctx.board.shapes([]);
    this.render();
    this.continueGame();
  }

  private async hint() {
    const g = this.game;
    if (!g || g.result || this.thinking || turnColor(this.chess) !== g.playerColor) return;
    const token = ++this.token;
    this.setStatus('计算提示…', 'muted');
    const res = await engine.search({ moves: g.moves, options: FULL_STRENGTH, movetime: 1200 });
    if (token !== this.token) return;
    this.refreshStatus();
    if (res.bestmove) this.ctx.board.arrow(res.bestmove, 'blue');
    if (res.score) this.ctx.evalBar.set(res.score);
  }

  private flip() {
    if (!this.game) return;
    this.ctx.board.toggleOrientation();
    this.game.orientation = this.ctx.board.orientation;
    this.ctx.evalBar.refresh();
    this.save();
  }

  private async updateEval() {
    const g = this.game;
    if (!g || !this.ctx.settings.showEval || this.thinking) return;
    const end = gameEnd(this.chess);
    if (end) return this.ctx.evalBar.set(end.kind === 'checkmate' ? { mate: end.winner === 'white' ? 1 : -1 } : { cp: 0 });
    const token = this.token;
    const res = await engine.search({ moves: g.moves, options: FULL_STRENGTH, movetime: 600 });
    if (token === this.token && res.score) this.ctx.evalBar.set(res.score);
  }

  private save() {
    store.saveGame(this.game);
  }

  // ---- rendering --------------------------------------------------------

  private render() {
    const g = this.game;
    const last = this.chess.history({ verbose: true }).at(-1);
    this.ctx.board.sync(this.chess, {
      orientation: g?.orientation ?? 'white',
      playerColor: g?.playerColor ?? 'white',
      interactive: !!g && !g.result && !this.thinking,
      lastMove: last ? [last.from, last.to] : null,
    });
    this.renderMoves();
    this.renderOpponent();
  }

  private refreshStatus() {
    const g = this.game;
    if (!g) return this.setStatus('选择执子和难度开始对局', 'muted');
    if (g.result) return this.setStatus(g.result, g.result.startsWith('你赢') ? 'good' : g.result.startsWith('你输') ? 'bad' : 'muted');
    if (!this.engineReady) return this.setStatus('引擎加载中…', 'muted');
    if (this.thinking) return this.setStatus('对手思考中…', 'muted');
    const check = this.chess.inCheck() ? ' · 被将军！' : '';
    this.setStatus(`轮到你走${check}`, check ? 'bad' : 'turn');
  }

  private setStatus(text: string, tone: 'muted' | 'good' | 'bad' | 'turn') {
    this.els.status.textContent = text;
    this.els.status.className = `status ${tone}`;
    this.els.undo.disabled = !this.game || this.game.moves.length === 0;
    this.els.hint.disabled = !this.game || !!this.game.result || this.thinking;
  }

  private renderOpponent() {
    const g = this.game;
    if (!g) return this.els.opponent.replaceChildren(h('span', {}, '人机对局'));
    const lv = levelById(g.level);
    this.els.opponent.replaceChildren(
      h('span.label', {}, `你执${g.playerColor === 'white' ? '白' : '黑'}`),
      h('span', {}, ` vs Stockfish · ${lv.name}（约 ${lv.elo}）`),
    );
  }

  private renderMoves() {
    const sans = this.chess.history();
    const rows: HTMLElement[] = [];
    for (let i = 0; i < sans.length; i += 2) {
      rows.push(h('span.num', {}, `${i / 2 + 1}.`), h('span.san', {}, sans[i]), h('span.san', {}, sans[i + 1] ?? ''));
    }
    this.els.moves.replaceChildren(...rows);
    this.els.moves.scrollTop = this.els.moves.scrollHeight;
  }

  private buildPanel() {
    const evalToggle = h('input', { type: 'checkbox', onchange: () => this.toggleEval() });
    evalToggle.checked = this.ctx.settings.showEval;
    this.els = {
      opponent: h('div.opponent'),
      status: h('div.status', { 'data-testid': 'game-status', 'aria-live': 'polite' }),
      moves: h('div.moves', { 'data-testid': 'move-list' }),
      undo: h('button.btn', { onclick: () => this.undo(), title: '悔棋 (U)' }, '悔棋'),
      hint: h('button.btn', { onclick: () => this.hint(), title: '提示 (H)' }, '提示'),
      evalToggle,
    };
    const e = this.els;
    this.ctx.panel.replaceChildren(
      e.opponent,
      e.status,
      e.moves,
      h(
        'div.buttons.grid4',
        {},
        e.undo,
        e.hint,
        h('button.btn', { onclick: () => this.flip(), title: '翻转棋盘 (F)' }, '翻转'),
        h('button.btn', { onclick: () => this.openNewGame(true), 'data-testid': 'new-game' }, '新对局'),
      ),
      h('label.toggle', {}, evalToggle, h('span', {}, '局面评估条')),
    );
    this.refreshStatus();
  }

  private toggleEval() {
    const on = this.els.evalToggle.checked;
    this.ctx.updateSettings({ showEval: on });
    this.ctx.evalBar.show(on);
    if (on) this.updateEval();
  }

  private showResult(title: string, reason: string) {
    const g = this.game!;
    this.ctx.modal.open(
      h(
        'div.result',
        { 'data-testid': 'game-result' },
        h('h2', {}, title),
        h('p', {}, reason),
        h(
          'div.buttons',
          {},
          h('button.btn', { onclick: () => this.ctx.modal.close() }, '查看棋盘'),
          h('button.btn.primary', { onclick: () => this.newGame(g.choice, g.level) }, '再来一局'),
        ),
      ),
    );
  }

  private openNewGame(dismissible: boolean) {
    let choice: SavedGame['choice'] = this.game?.choice ?? 'white';
    let level = this.game?.level ?? 3;
    const colorBtns = (['white', 'random', 'black'] as const).map((c) =>
      h('button.seg', { 'data-color': c, onclick: () => ((choice = c), sync()) }, { white: '执白', random: '随机', black: '执黑' }[c]),
    );
    const levelBtns = LEVELS.map((l) =>
      h(
        'button.level',
        { 'data-level': l.id, onclick: () => ((level = l.id), sync()) },
        h('strong', {}, `${l.id} · ${l.name}`),
        h('span', {}, `约 ${l.elo}`),
      ),
    );
    const sync = () => {
      colorBtns.forEach((b) => b.classList.toggle('on', b.dataset.color === choice));
      levelBtns.forEach((b) => b.classList.toggle('on', Number(b.dataset.level) === level));
    };
    sync();
    this.ctx.modal.open(
      h(
        'div.newgame',
        { 'data-testid': 'new-game-dialog' },
        h('h2', {}, '新对局'),
        h('div.segmented', {}, colorBtns),
        h('div.levels', {}, levelBtns),
        h(
          'div.buttons',
          {},
          dismissible ? h('button.btn', { onclick: () => this.ctx.modal.close() }, '取消') : null,
          h('button.btn.primary', { onclick: () => this.newGame(choice, level), 'data-testid': 'start-game' }, '开始对局'),
        ),
      ),
      { dismissible },
    );
  }
}

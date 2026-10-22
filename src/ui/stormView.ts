import { Chess } from 'chess.js';
import type { Puzzle } from '../core/puzzle';
import { selectPuzzle } from '../core/selector';
import { store } from '../core/storage';
import type { Ctx, PuzzleDb, View } from './context';
import { h } from './dom';
import { PuzzlePlayer } from './puzzlePlayer';
import { play } from './sound';

const DURATION_MS = 3 * 60 * 1000;
const MAX_STRIKES = 3;

/** Timed run: solve as many puzzles as possible in 3 minutes; 3 mistakes end it. */
export class StormView implements View {
  private db: PuzzleDb | null = null;
  private player: PuzzlePlayer;
  private running = false;
  private score = 0;
  private strikes = 0;
  private endsAt = 0;
  private tick: ReturnType<typeof setInterval> | null = null;
  private advance: ReturnType<typeof setTimeout> | null = null;
  private used = new Set<string>();
  private els!: { clock: HTMLElement; score: HTMLElement; strikes: HTMLElement; body: HTMLElement; best: HTMLElement };

  constructor(private ctx: Ctx) {
    this.player = new PuzzlePlayer(
      ctx.board,
      {
        phase: () => {},
        wrong: () => this.onWrong(),
        solved: (clean) => clean && this.onSolved(),
      },
      { replyDelay: [250, 350], retryOnWrong: false },
    );
  }

  mount() {
    this.ctx.evalBar.show(false);
    this.els = {
      clock: h('span.big.clock', { 'data-testid': 'storm-clock' }, '3:00'),
      score: h('span.big', { 'data-testid': 'storm-score' }, '0'),
      strikes: h('span.strikes'),
      body: h('div.storm-body'),
      best: h('span'),
    };
    this.ctx.panel.replaceChildren(
      h(
        'div.stats',
        {},
        h('div.stat', {}, h('span.label', {}, '时间'), this.els.clock),
        h('div.stat', {}, h('span.label', {}, '得分'), this.els.score),
        h('div.stat', {}, h('span.label', {}, '失误'), this.els.strikes),
      ),
      this.els.body,
    );
    this.renderStrikes();
    this.showIntro();
    this.ctx.puzzles().then((db) => (this.db = db));
  }

  unmount() {
    this.stopRun();
  }

  onUserMove(uci: string) {
    if (this.running) this.player.userMove(uci);
    else this.player.render();
  }

  onKey(key: string): boolean {
    if (!this.running && (key === 'Enter' || key === ' ')) return this.start(), true;
    return false;
  }

  private showIntro(last?: number, newRecord = false) {
    const rec = store.loadStorm();
    const chess = new Chess();
    this.ctx.board.sync(chess, { orientation: 'white', playerColor: 'white', interactive: false });
    this.ctx.board.shapes([]);
    this.els.body.replaceChildren(
      last !== undefined
        ? h('div.status.good', { 'data-testid': 'storm-result' }, newRecord ? `新纪录：${last} 题！` : `本轮：${last} 题`)
        : h('div.status.muted', {}, '3 分钟内尽量多解题，错 3 题结束。题目由易到难。'),
      h('p.muted-text', {}, `最高分 ${rec.best} · 已玩 ${rec.runs} 轮`),
      h('div.buttons', {}, h('button.btn.primary', { onclick: () => this.start(), 'data-testid': 'storm-start' }, last !== undefined ? '再来一轮' : '开始冲刺')),
    );
  }

  private start() {
    if (!this.db) return;
    this.running = true;
    this.score = 0;
    this.strikes = 0;
    this.used.clear();
    this.endsAt = performance.now() + DURATION_MS;
    this.els.score.textContent = '0';
    this.renderStrikes();
    this.els.body.replaceChildren(h('div.status.turn', {}, '开始！'), h('div.buttons', {}, h('button.btn', { onclick: () => this.end() }, '结束本轮')));
    this.tick = setInterval(() => this.updateClock(), 200);
    this.updateClock();
    this.nextPuzzle();
  }

  private nextPuzzle() {
    if (!this.running || !this.db) return;
    // Ramp difficulty: start easy and climb ~40 points per solved puzzle.
    const target = 700 + this.score * 40;
    const p: Puzzle | null = selectPuzzle(this.db.list, { rating: target, recent: this.used });
    if (!p) return this.end();
    this.used.add(p.id);
    this.player.load(p);
  }

  private onSolved() {
    this.score++;
    this.els.score.textContent = String(this.score);
    this.schedule(250);
  }

  private onWrong() {
    this.strikes++;
    this.renderStrikes();
    if (this.strikes >= MAX_STRIKES) {
      setTimeout(() => this.end(), 500);
      this.player.stop();
      return;
    }
    this.schedule(600);
  }

  private schedule(ms: number) {
    if (this.advance) clearTimeout(this.advance);
    this.advance = setTimeout(() => this.nextPuzzle(), ms);
  }

  private updateClock() {
    const left = Math.max(0, this.endsAt - performance.now());
    const s = Math.ceil(left / 1000);
    this.els.clock.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    this.els.clock.classList.toggle('low', s <= 20);
    if (left <= 0) this.end();
  }

  private end() {
    if (!this.running) return;
    this.stopRun();
    play('end');
    const rec = store.loadStorm();
    store.saveStorm({ best: Math.max(rec.best, this.score), runs: rec.runs + 1 });
    this.showIntro(this.score, this.score > rec.best);
  }

  private stopRun() {
    this.running = false;
    this.player.stop();
    if (this.tick) clearInterval(this.tick);
    if (this.advance) clearTimeout(this.advance);
    this.tick = this.advance = null;
  }

  private renderStrikes() {
    this.els.strikes.replaceChildren(
      ...Array.from({ length: MAX_STRIKES }, (_, i) => h('span.strike', { class: i < this.strikes ? 'on' : '' }, '✕')),
    );
  }
}

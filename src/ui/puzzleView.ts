import type { Puzzle } from '../core/puzzle';
import { recordResult, rememberRecent } from '../core/progress';
import { selectPuzzle } from '../core/selector';
import { store, type PuzzleProgress } from '../core/storage';
import { THEME_FILTERS, themeName, visibleThemes } from '../core/themes';
import type { Ctx, PuzzleDb, View } from './context';
import { h } from './dom';
import { PuzzlePlayer, type PlayerPhase } from './puzzlePlayer';

const AUTO_NEXT_MS = 800;

/** Rated puzzle training: one puzzle after another around the player's rating. */
export class PuzzleView implements View {
  private progress: PuzzleProgress = store.loadProgress();
  private db: PuzzleDb | null = null;
  private player: PuzzlePlayer;
  /** Pre-selected next puzzle so advancing is instant. */
  private next: Puzzle | null = null;
  private autoNextTimer: ReturnType<typeof setTimeout> | null = null;
  private lastDelta: number | null = null;
  private justWrong = false;
  private els!: {
    rating: HTMLElement;
    ratingNote: HTMLElement;
    streak: HTMLElement;
    status: HTMLElement;
    meta: HTMLElement;
    themes: HTMLElement;
    hint: HTMLButtonElement;
    solution: HTMLButtonElement;
    next: HTMLButtonElement;
    filter: HTMLSelectElement;
    history: HTMLElement;
  };

  constructor(private ctx: Ctx) {
    this.player = new PuzzlePlayer(
      ctx.board,
      {
        phase: (p) => this.onPhase(p),
        progressed: (ply) => {
          this.justWrong = false;
          this.saveCurrent({ ply });
        },
        wrong: (first) => this.onWrong(first),
        solved: (clean) => this.onSolved(clean),
      },
      { replyDelay: [300, 500], retryOnWrong: true },
    );
  }

  mount() {
    this.buildPanel();
    this.ctx.evalBar.show(false);
    this.setStatus('加载题库…');
    this.ctx.puzzles().then(
      (db) => {
        this.db = db;
        this.resumeOrNext();
      },
      (err) => this.setStatus(`题库加载失败：${err instanceof Error ? err.message : err}`, 'bad'),
    );
  }

  unmount() {
    this.player.stop();
    this.clearAutoNext();
  }

  onUserMove(uci: string) {
    this.player.userMove(uci);
  }

  onKey(key: string): boolean {
    if (key === 'ArrowRight') return this.goNext(), true;
    if (key === 'h' || key === 'H') return this.hint(), true;
    return false;
  }

  // ---- flow -------------------------------------------------------------

  private resumeOrNext() {
    const cur = this.progress.current;
    const p = cur && this.db!.byId.get(cur.id);
    // A puzzle that was already finished before the reload just moves on.
    if (!cur || !p || cur.ply >= p.moves.length) return this.goNext();
    this.startPuzzle(p, cur.ply > 0 ? { ply: cur.ply, failed: cur.failed } : undefined);
  }

  private goNext() {
    if (!this.db) return;
    const phase = this.player.phase;
    // → only advances once the current puzzle is over.
    if (this.player.runner && phase !== 'done' && !(phase === 'idle')) return;
    this.clearAutoNext();
    const p = this.next && this.matchesFilter(this.next) ? this.next : this.pick();
    if (!p) return this.setStatus('没有符合该主题的题目', 'bad');
    this.startPuzzle(p);
  }

  private startPuzzle(p: Puzzle, resume?: { ply: number; failed: boolean }) {
    this.clearAutoNext();
    this.lastDelta = null;
    this.justWrong = false;
    const cur = this.progress.current;
    const same = cur?.id === p.id;
    this.progress.current = {
      id: p.id,
      ply: resume?.ply ?? 0,
      failed: resume?.failed ?? false,
      recorded: same ? cur!.recorded : false,
    };
    this.progress.recent = rememberRecent(this.progress.recent, p.id);
    this.save();
    this.player.load(p, resume);
    this.renderPuzzleInfo(p);
    this.next = this.pick(p.id);
  }

  private pick(excludeId?: string): Puzzle | null {
    if (!this.db) return null;
    const filter = THEME_FILTERS.find((f) => f.id === this.ctx.settings.themeFilter) ?? THEME_FILTERS[0];
    return selectPuzzle(this.db.list, {
      rating: this.progress.glicko.rating,
      recent: new Set(this.progress.recent.slice(0, 1000)),
      themes: filter.themes,
      exclude: excludeId ? new Set([excludeId]) : undefined,
    });
  }

  private matchesFilter(p: Puzzle): boolean {
    const filter = THEME_FILTERS.find((f) => f.id === this.ctx.settings.themeFilter) ?? THEME_FILTERS[0];
    return filter.themes.length === 0 || p.themes.some((t) => filter.themes.includes(t));
  }

  private hint() {
    if (this.player.hint()) {
      this.record(false);
      this.setStatus('已使用提示，本题不计分', 'muted');
    }
  }

  private showSolution() {
    if (this.player.showSolution()) {
      this.record(false);
    }
  }

  private onWrong(first: boolean) {
    if (first) this.record(false);
    this.justWrong = true;
    this.setStatus('不对，再想想', 'bad');
    this.saveCurrent({ failed: true });
  }

  private onSolved(clean: boolean) {
    this.saveCurrent({ ply: this.player.runner!.ply, failed: !clean, finished: true });
    if (clean) this.record(true);
    this.renderStats();
    if (clean && this.ctx.settings.autoNext) {
      this.autoNextTimer = setTimeout(() => this.goNext(), AUTO_NEXT_MS);
    }
  }

  /** Records the rating result once per puzzle. */
  private record(solved: boolean) {
    const cur = this.progress.current;
    const p = this.player.puzzle;
    if (!cur || !p || cur.recorded) return;
    const before = Math.round(this.progress.glicko.rating);
    this.progress = recordResult(this.progress, p, solved);
    this.progress.current = { ...cur, recorded: true, failed: cur.failed || !solved };
    this.lastDelta = Math.round(this.progress.glicko.rating) - before;
    this.save();
    this.renderStats();
  }

  private saveCurrent(patch: { ply?: number; failed?: boolean; finished?: boolean }) {
    const cur = this.progress.current;
    if (!cur) return;
    if (patch.ply !== undefined) cur.ply = patch.ply;
    if (patch.failed) cur.failed = true;
    // A finished puzzle has nothing left to resume: a reload moves on to the next one.
    if (patch.finished) cur.ply = Number.MAX_SAFE_INTEGER;
    this.save();
  }

  private save() {
    store.saveProgress(this.progress);
  }

  private clearAutoNext() {
    if (this.autoNextTimer) clearTimeout(this.autoNextTimer);
    this.autoNextTimer = null;
  }

  // ---- panel ------------------------------------------------------------

  private onPhase(p: PlayerPhase) {
    this.els.status.dataset.phase = p;
    const r = this.player.runner;
    if (!r) return;
    const side = r.playerColor === 'white' ? '白方' : '黑方';
    const playing = p === 'player' || p === 'opponent' || p === 'opening';
    this.els.hint.disabled = p !== 'player';
    this.els.solution.disabled = !playing || p === 'opening';
    this.els.next.hidden = p !== 'done';
    this.els.hint.hidden = p === 'done';
    this.els.solution.hidden = p === 'done';
    switch (p) {
      case 'opening':
        this.setStatus(`你执${side}`, 'muted');
        break;
      case 'player':
        if (this.justWrong) this.setStatus('不对，再想想', 'bad');
        else if (r.ply <= 1) this.setStatus(`轮到你走 · 执${side}`, 'turn');
        else this.setStatus('很好，继续', 'good');
        break;
      case 'replay':
        this.setStatus('正在演示答案…', 'muted');
        break;
      case 'done': {
        if (r.failed) this.setStatus('本题结束（不计分）', 'muted');
        else {
          const d = this.lastDelta;
          this.setStatus(`解题成功！${d !== null ? ` 评分 ${d >= 0 ? '+' : ''}${d}` : ''}`, 'good');
        }
        break;
      }
    }
  }

  private setStatus(text: string, tone: 'muted' | 'good' | 'bad' | 'turn' = 'muted') {
    this.els.status.textContent = text;
    this.els.status.className = `status ${tone}`;
  }

  private buildPanel() {
    const filter = h(
      'select.filter',
      { 'aria-label': '主题筛选', onchange: () => this.onFilter() },
      THEME_FILTERS.map((f) => h('option', { value: f.id }, f.label)),
    );
    filter.value = this.ctx.settings.themeFilter;
    this.els = {
      rating: h('span.big', { 'data-testid': 'puzzle-rating' }),
      ratingNote: h('span.note'),
      streak: h('span.big', { 'data-testid': 'puzzle-streak' }),
      status: h('div.status', { 'data-testid': 'puzzle-status', 'aria-live': 'polite' }),
      meta: h('div.meta', { 'data-testid': 'puzzle-meta' }),
      themes: h('div.chips'),
      hint: h('button.btn', { onclick: () => this.hint(), title: '提示 (H)' }, '提示'),
      solution: h('button.btn', { onclick: () => this.showSolution() }, '看答案'),
      next: h('button.btn.primary', { onclick: () => this.goNext(), title: '下一题 (→)', 'data-testid': 'next-puzzle' }, '下一题 →'),
      filter,
      history: h('div.history', { 'aria-label': '最近结果' }),
    };
    const e = this.els;
    e.next.hidden = true;
    this.ctx.panel.replaceChildren(
      h(
        'div.stats',
        {},
        h('div.stat', {}, h('span.label', {}, '谜题评分'), h('span', {}, e.rating, e.ratingNote)),
        h('div.stat', {}, h('span.label', {}, '连对'), e.streak),
      ),
      e.status,
      h('div.puzzle-info', {}, e.meta, e.themes),
      h('div.buttons', {}, e.hint, e.solution, e.next),
      h('div.panel-foot', {}, e.filter, e.history),
    );
    this.renderStats();
  }

  private onFilter() {
    this.ctx.updateSettings({ themeFilter: this.els.filter.value });
    this.next = null;
    // Switching theme gives a fresh puzzle right away; an unfinished one isn't scored.
    this.player.stop();
    this.player.phase = 'idle';
    this.goNext();
  }

  private renderPuzzleInfo(p: Puzzle) {
    this.els.meta.replaceChildren(
      h('span', {}, '难度 '),
      h('strong', { 'data-testid': 'puzzle-difficulty' }, String(p.rating)),
      h('a.pid', { href: `https://lichess.org/training/${p.id}`, target: '_blank', rel: 'noopener' }, `#${p.id}`),
    );
    this.els.themes.replaceChildren(...visibleThemes(p.themes).map((t) => h('span.chip', {}, themeName(t))));
  }

  private renderStats() {
    const g = this.progress.glicko;
    this.els.rating.textContent = String(Math.round(g.rating));
    this.els.ratingNote.textContent = g.rd > 110 ? ' 暂定' : '';
    this.els.streak.textContent = String(this.progress.streak);
    const recent = this.progress.history.slice(0, 16).reverse();
    this.els.history.replaceChildren(
      ...recent.map((x) =>
        h('span.dot', {
          class: x.solved ? 'ok' : 'fail',
          title: `${x.solved ? '✓' : '✗'} 难度 ${x.puzzleRating}，评分 ${x.delta >= 0 ? '+' : ''}${x.delta}`,
        }),
      ),
    );
  }
}

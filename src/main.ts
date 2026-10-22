import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.cburnett.css';
import './styles.css';

import { puzzleFromRow, type PuzzleRow } from './core/puzzle';
import { store, type Settings, type View as ViewName } from './core/storage';
import { Board } from './ui/board';
import type { Ctx, EvalBar, Modal, PuzzleDb, View } from './ui/context';
import { GameView } from './ui/gameView';
import { PuzzleView } from './ui/puzzleView';
import { settingsPanel } from './ui/settingsPanel';
import { setSoundEnabled, unlockAudio } from './ui/sound';
import { StormView } from './ui/stormView';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;

let settings: Settings = store.loadSettings();

function applySettings() {
  const root = document.documentElement;
  if (settings.theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = settings.theme;
  root.dataset.board = settings.board;
  setSoundEnabled(settings.sound);
  const btn = $('#sound-toggle');
  btn.classList.toggle('off', !settings.sound);
  btn.setAttribute('aria-label', settings.sound ? '静音' : '打开声音');
  btn.title = settings.sound ? '静音' : '打开声音';
}

function updateSettings(patch: Partial<Settings>) {
  settings = { ...settings, ...patch };
  ctx.settings = settings;
  store.saveSettings(settings);
  applySettings();
}

// ---- puzzle database (loaded once, lazily) --------------------------------

let dbPromise: Promise<PuzzleDb> | null = null;
function loadPuzzles(): Promise<PuzzleDb> {
  dbPromise ??= (async () => {
    const res = await fetch(new URL('puzzles.json.gz', document.baseURI));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = new Uint8Array(await res.arrayBuffer());
    // Some hosts decode .gz transparently (Content-Encoding); only gunzip raw gzip bytes.
    let text: string;
    if (buf[0] === 0x1f && buf[1] === 0x8b) {
      const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
      text = await new Response(stream).text();
    } else {
      text = new TextDecoder().decode(buf);
    }
    const data = JSON.parse(text) as { puzzles: PuzzleRow[] };
    const list = data.puzzles.map(puzzleFromRow);
    return { list, byId: new Map(list.map((p) => [p.id, p])) };
  })();
  dbPromise.catch(() => (dbPromise = null));
  return dbPromise;
}

// ---- eval bar & modal -----------------------------------------------------

const evalEl = $('#evalbar');
const evalFill = $('#evalbar .fill');
let lastScore: Parameters<EvalBar['set']>[0] = null;
const evalBar: EvalBar = {
  refresh() {
    evalBar.set(lastScore);
  },
  show(on) {
    evalEl.hidden = !on;
    document.body.classList.toggle('with-eval', on);
  },
  set(score) {
    lastScore = score;
    evalEl.classList.toggle('flip', board.orientation === 'black');
    let white = 50;
    let label = '';
    if (score?.mate !== undefined) {
      white = score.mate > 0 || Object.is(score.mate, 0) ? 100 : 0;
      label = `M${Math.abs(score.mate)}`;
    } else if (score?.cp !== undefined) {
      white = 50 + 50 * (2 / (1 + Math.exp(-0.004 * score.cp)) - 1);
      label = (score.cp / 100).toFixed(1);
    }
    evalFill.style.height = `${white}%`;
    evalEl.title = label ? `评估 ${label}` : '';
    evalEl.dataset.label = label;
  },
};

const dialog = $('#modal') as HTMLDialogElement;
let dismissible = true;
const modal: Modal = {
  open(content, opts) {
    dismissible = opts?.dismissible ?? true;
    dialog.replaceChildren(content);
    if (!dialog.open) dialog.showModal();
  },
  close() {
    if (dialog.open) dialog.close();
  },
};
dialog.addEventListener('cancel', (e) => {
  if (!dismissible) e.preventDefault();
});
dialog.addEventListener('click', (e) => {
  if (e.target === dialog && dismissible) dialog.close();
});

// ---- views ----------------------------------------------------------------

const board = new Board($('#board'), (uci) => current?.onUserMove(uci));
const ctx: Ctx = {
  board,
  panel: $('#panel'),
  settings,
  updateSettings,
  puzzles: loadPuzzles,
  evalBar,
  modal,
};

let current: View | null = null;
let currentName: ViewName = store.loadView();
const makers: Record<ViewName, () => View> = {
  puzzle: () => new PuzzleView(ctx),
  storm: () => new StormView(ctx),
  game: () => new GameView(ctx),
};

function show(name: ViewName) {
  current?.unmount();
  modal.close();
  board.shapes([]);
  currentName = name;
  store.saveView(name);
  document.querySelectorAll<HTMLElement>('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.view === name));
  document.body.dataset.view = name;
  current = makers[name]();
  current.mount();
}

document.querySelectorAll<HTMLElement>('.tabs button').forEach((b) =>
  b.addEventListener('click', () => show(b.dataset.view as ViewName)),
);

$('#sound-toggle').addEventListener('click', () => updateSettings({ sound: !settings.sound }));
$('#settings-open').addEventListener('click', () =>
  modal.open(
    settingsPanel(settings, updateSettings, () => modal.close(), () => show(currentName)),
  ),
);

document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (dialog.open || (e.target as HTMLElement).closest('input, select, textarea')) return;
  if ((e.key === 'f' || e.key === 'F') && currentName !== 'game') {
    board.toggleOrientation();
    e.preventDefault();
    return;
  }
  if (current?.onKey(e.key)) e.preventDefault();
});

// iOS: audio can only start from a user gesture.
for (const ev of ['pointerdown', 'keydown'] as const) window.addEventListener(ev, unlockAudio, { passive: true });

applySettings();
evalBar.show(false);
show(currentName);
// Fetch the puzzle set early even when starting in game mode.
void loadPuzzles().catch(() => {});

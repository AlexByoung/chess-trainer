import { defaultProgress, PIECE_SETS, store, type BoardTheme, type PieceSet, type Settings, type ThemeMode } from '../core/storage';
import { h } from './dom';

const THEMES: [ThemeMode, string][] = [
  ['system', '跟随系统'],
  ['light', '浅色'],
  ['dark', '深色'],
];

const BOARDS: [BoardTheme, string][] = [
  ['green', '青绿'],
  ['brown', '木纹'],
  ['blue', '灰蓝'],
];

/** Builds the settings sheet; every change is applied immediately through `update`. */
export function settingsPanel(
  settings: Settings,
  update: (patch: Partial<Settings>) => void,
  close: () => void,
  onResetPuzzles: () => void,
): HTMLElement {
  const progress = store.loadProgress();
  const storm = store.loadStorm();
  const rate = progress.attempted ? Math.round((progress.solved / progress.attempted) * 100) : 0;

  const seg = <T extends string>(items: [T, string][], current: T, onPick: (v: T) => void, cls = '') => {
    const btns = items.map(([v, label]) =>
      h('button.seg', { class: `${cls} ${v === current ? 'on' : ''}`.trim(), 'data-value': v, onclick: () => pick(v) }, label),
    );
    const pick = (v: T) => {
      btns.forEach((b) => b.classList.toggle('on', b.dataset.value === v));
      onPick(v);
    };
    return h('div.segmented', {}, btns);
  };

  const toggle = (label: string, key: 'sound' | 'autoNext' | 'haptics') => {
    const input = h('input', { type: 'checkbox', onchange: () => update({ [key]: input.checked }) });
    input.checked = settings[key];
    return h('label.toggle', {}, input, h('span', {}, label));
  };

  const boardSeg = seg(BOARDS, settings.board, (v) => update({ board: v }), 'swatch');
  boardSeg.querySelectorAll<HTMLElement>('.seg').forEach((b) => b.prepend(h('i', { class: `sw sw-${b.dataset.value}` })));

  const pieceBtns = PIECE_SETS.map((set) =>
    h(
      'button.piece-choice',
      { class: set === settings.pieces ? 'on' : '', 'data-set': set, title: set, 'aria-label': `棋子 ${set}`, onclick: () => pickPieces(set) },
      h('img', { src: `pieces/${set}/wN.svg`, alt: '' }),
      h('img', { src: `pieces/${set}/bR.svg`, alt: '' }),
    ),
  );
  const pickPieces = (set: PieceSet) => {
    pieceBtns.forEach((b) => b.classList.toggle('on', b.dataset.set === set));
    update({ pieces: set });
  };

  const reset = h(
    'button.btn.danger',
    {
      onclick: () => {
        if (reset.dataset.confirm) {
          store.saveProgress(defaultProgress());
          onResetPuzzles();
          close();
        } else {
          reset.dataset.confirm = '1';
          reset.textContent = '再点一次确认重置';
        }
      },
    },
    '重置谜题进度',
  );

  return h(
    'div.settings',
    {},
    h('h2', {}, '设置'),
    h('h3', {}, '外观'),
    seg(THEMES, settings.theme, (v) => update({ theme: v })),
    h('h3', {}, '棋盘配色'),
    boardSeg,
    h('h3', {}, '棋子样式'),
    h('div.piece-sets', {}, pieceBtns),
    h('h3', {}, '偏好'),
    toggle('音效', 'sound'),
    toggle('走错时震动（手机）', 'haptics'),
    toggle('解对后自动进入下一题', 'autoNext'),
    h('h3', {}, '记录'),
    h(
      'p.muted-text',
      {},
      `谜题评分 ${Math.round(progress.glicko.rating)} · 已做 ${progress.attempted} 题 · 正确率 ${rate}% · 最高连对 ${progress.bestStreak} · 冲刺最高 ${storm.best}`,
    ),
    h('div.buttons', {}, reset, h('button.btn.primary', { onclick: close }, '完成')),
    h(
      'p.foot',
      {},
      '谜题来自 Lichess 公开题库（CC0），引擎 Stockfish（GPLv3），棋盘 chessground（GPLv3），棋子来自 Lichess（见 pieces/LICENSES.md）。版本 ',
      h('code', {}, __APP_VERSION__),
    ),
  );
}

import { defaultProgress, PIECE_SETS, store, type BoardTheme, type Lang, type PieceSet, type Settings, type ThemeMode } from '../core/storage';
import { t } from '../i18n';
import { h } from './dom';

/** Builds the settings sheet; every change is applied immediately through `update`. */
export function settingsPanel(
  settings: Settings,
  update: (patch: Partial<Settings>) => void,
  close: () => void,
  onResetPuzzles: () => void,
): HTMLElement {
  const THEMES: [ThemeMode, string][] = [
    ['system', t('themeSystem')],
    ['light', t('themeLight')],
    ['dark', t('themeDark')],
  ];
  const BOARDS: [BoardTheme, string][] = [
    ['green', t('boardGreen')],
    ['brown', t('boardBrown')],
    ['blue', t('boardBlue')],
  ];
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
      { class: set === settings.pieces ? 'on' : '', 'data-set': set, title: set, 'aria-label': t('pieceSet', set), onclick: () => pickPieces(set) },
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
          reset.textContent = t('confirmReset');
        }
      },
    },
    t('resetProgress'),
  );

  return h(
    'div.settings',
    {},
    h('h2', {}, t('settings')),
    h('h3', {}, t('language')),
    seg<Lang>(
      [
        ['zh', '中文'],
        ['en', 'English'],
      ],
      settings.lang,
      (v) => update({ lang: v }),
    ),
    h('h3', {}, t('appearance')),
    seg(THEMES, settings.theme, (v) => update({ theme: v })),
    h('h3', {}, t('boardColors')),
    boardSeg,
    h('h3', {}, t('pieceStyle')),
    h('div.piece-sets', {}, pieceBtns),
    h('h3', {}, t('preferences')),
    toggle(t('sound'), 'sound'),
    toggle(t('haptics'), 'haptics'),
    toggle(t('autoNext'), 'autoNext'),
    h('h3', {}, t('stats')),
    h(
      'p.muted-text',
      {},
      t('statsLine', Math.round(progress.glicko.rating), progress.attempted, rate, progress.bestStreak, storm.best),
    ),
    h('div.buttons', {}, reset, h('button.btn.primary', { onclick: close }, t('done'))),
    h(
      'p.foot',
      {},
      t('credits'),
      h('code', {}, __APP_VERSION__),
    ),
  );
}

/** UI strings in Simplified Chinese and English. */

export type Lang = 'zh' | 'en';

let lang: Lang = 'zh';

export function setLang(l: Lang): void {
  lang = l;
  document.documentElement.lang = l === 'zh' ? 'zh-CN' : 'en';
}

export function getLang(): Lang {
  return lang;
}

type Entry = { zh: string; en: string };

const S = {
  // shell
  appTitle: { zh: '棋练', en: 'Chess Trainer' },
  tabPuzzle: { zh: '谜题', en: 'Puzzles' },
  tabStorm: { zh: '冲刺', en: 'Storm' },
  tabGame: { zh: '对局', en: 'Play' },
  modes: { zh: '模式', en: 'Modes' },
  settings: { zh: '设置', en: 'Settings' },
  mute: { zh: '静音', en: 'Mute' },
  unmute: { zh: '打开声音', en: 'Sound on' },
  evalTitle: { zh: '评估 {0}', en: 'Eval {0}' },
  // board
  choosePromotion: { zh: '选择升变棋子', en: 'Choose promotion piece' },
  queen: { zh: '后', en: 'Queen' },
  knight: { zh: '马', en: 'Knight' },
  rook: { zh: '车', en: 'Rook' },
  bishop: { zh: '象', en: 'Bishop' },
  // puzzles
  loadingPuzzles: { zh: '加载题库…', en: 'Loading puzzles…' },
  puzzlesFailed: { zh: '题库加载失败：{0}', en: 'Could not load puzzles: {0}' },
  noPuzzleForTheme: { zh: '没有符合该主题的题目', en: 'No puzzles for this theme' },
  hintUsed: { zh: '已使用提示，本题不计分', en: 'Hint used: this puzzle won’t count' },
  wrong: { zh: '不对，再想想', en: 'Not quite, try again' },
  white: { zh: '白方', en: 'White' },
  black: { zh: '黑方', en: 'Black' },
  youPlay: { zh: '你执{0}', en: 'You play {0}' },
  yourTurnSide: { zh: '轮到你走 · 执{0}', en: 'Your turn · {0}' },
  goodContinue: { zh: '很好，继续', en: 'Good, keep going' },
  showingSolution: { zh: '正在演示答案…', en: 'Showing the solution…' },
  puzzleOverUnrated: { zh: '本题结束（不计分）', en: 'Puzzle over (not counted)' },
  solved: { zh: '解题成功！', en: 'Solved!' },
  ratingDelta: { zh: ' 评分 {0}', en: ' Rating {0}' },
  themeFilter: { zh: '主题筛选', en: 'Theme filter' },
  hint: { zh: '提示', en: 'Hint' },
  showAnswer: { zh: '看答案', en: 'Solution' },
  nextPuzzle: { zh: '下一题 →', en: 'Next →' },
  nextPuzzleTitle: { zh: '下一题 (→)', en: 'Next puzzle (→)' },
  hintTitle: { zh: '提示 (H)', en: 'Hint (H)' },
  recentResults: { zh: '最近结果', en: 'Recent results' },
  puzzleRating: { zh: '谜题评分', en: 'Puzzle rating' },
  streak: { zh: '连对', en: 'Streak' },
  difficulty: { zh: '难度 ', en: 'Rating ' },
  provisional: { zh: ' 暂定', en: '?' },
  historyItem: { zh: '{0} 难度 {1}，评分 {2}', en: '{0} rating {1}, change {2}' },
  // storm
  time: { zh: '时间', en: 'Time' },
  score: { zh: '得分', en: 'Score' },
  strikes: { zh: '失误', en: 'Mistakes' },
  newRecord: { zh: '新纪录：{0} 题！', en: 'New record: {0}!' },
  thisRun: { zh: '本轮：{0} 题', en: 'This run: {0}' },
  stormIntro: { zh: '3 分钟内尽量多解题，错 3 题结束。题目由易到难。', en: 'Solve as many puzzles as you can in 3 minutes. 3 mistakes and you’re out. Puzzles get harder as you go.' },
  stormBest: { zh: '最高分 {0} · 已玩 {1} 轮', en: 'Best {0} · {1} runs played' },
  playAgainRun: { zh: '再来一轮', en: 'Play again' },
  startStorm: { zh: '开始冲刺', en: 'Start' },
  go: { zh: '开始！', en: 'Go!' },
  endRun: { zh: '结束本轮', en: 'End run' },
  // game
  checkmate: { zh: '将杀', en: 'Checkmate' },
  stalemate: { zh: '逼和', en: 'Stalemate' },
  threefold: { zh: '三次重复局面', en: 'Threefold repetition' },
  fifty: { zh: '50 步规则', en: '50-move rule' },
  insufficient: { zh: '子力不足', en: 'Insufficient material' },
  engineFailed: { zh: '引擎加载失败：{0}', en: 'Engine failed to load: {0}' },
  youWon: { zh: '你赢了', en: 'You won' },
  youLost: { zh: '你输了', en: 'You lost' },
  draw: { zh: '和棋', en: 'Draw' },
  computingHint: { zh: '计算提示…', en: 'Thinking of a hint…' },
  pickToStart: { zh: '选择执子和难度开始对局', en: 'Pick a side and level to start' },
  engineLoading: { zh: '引擎加载中…', en: 'Loading engine…' },
  aiThinking: { zh: '对手思考中…', en: 'Opponent is thinking…' },
  yourTurn: { zh: '轮到你走', en: 'Your move' },
  inCheck: { zh: ' · 被将军！', en: ' · Check!' },
  vsComputer: { zh: '人机对局', en: 'Play the computer' },
  youAreWhite: { zh: '你执白', en: 'You: White' },
  youAreBlack: { zh: '你执黑', en: 'You: Black' },
  vsLevel: { zh: ' vs Stockfish · {0}（约 {1}）', en: ' vs Stockfish · {0} (~{1})' },
  undo: { zh: '悔棋', en: 'Undo' },
  undoTitle: { zh: '悔棋 (U)', en: 'Take back (U)' },
  flip: { zh: '翻转', en: 'Flip' },
  flipTitle: { zh: '翻转棋盘 (F)', en: 'Flip board (F)' },
  newGame: { zh: '新对局', en: 'New game' },
  evalBar: { zh: '局面评估条', en: 'Evaluation bar' },
  viewBoard: { zh: '查看棋盘', en: 'View board' },
  playAgain: { zh: '再来一局', en: 'Play again' },
  playWhite: { zh: '执白', en: 'White' },
  playRandom: { zh: '随机', en: 'Random' },
  playBlack: { zh: '执黑', en: 'Black' },
  about: { zh: '约 {0}', en: '~{0}' },
  cancel: { zh: '取消', en: 'Cancel' },
  startGame: { zh: '开始对局', en: 'Start game' },
  // levels
  level1: { zh: '入门', en: 'Beginner' },
  level2: { zh: '初级', en: 'Novice' },
  level3: { zh: '中级', en: 'Intermediate' },
  level4: { zh: '进阶', en: 'Advanced' },
  level5: { zh: '高手', en: 'Expert' },
  level6: { zh: '大师', en: 'Master' },
  // settings
  language: { zh: '语言 / Language', en: 'Language / 语言' },
  appearance: { zh: '外观', en: 'Appearance' },
  themeSystem: { zh: '跟随系统', en: 'System' },
  themeLight: { zh: '浅色', en: 'Light' },
  themeDark: { zh: '深色', en: 'Dark' },
  boardColors: { zh: '棋盘配色', en: 'Board' },
  boardGreen: { zh: '青绿', en: 'Green' },
  boardBrown: { zh: '木纹', en: 'Wood' },
  boardBlue: { zh: '灰蓝', en: 'Blue' },
  pieceStyle: { zh: '棋子样式', en: 'Pieces' },
  pieceSet: { zh: '棋子 {0}', en: 'Pieces {0}' },
  preferences: { zh: '偏好', en: 'Preferences' },
  sound: { zh: '音效', en: 'Sound' },
  haptics: { zh: '走错时震动（手机）', en: 'Vibrate on mistakes (phones)' },
  autoNext: { zh: '解对后自动进入下一题', en: 'Jump to next puzzle after solving' },
  stats: { zh: '记录', en: 'Stats' },
  statsLine: {
    zh: '谜题评分 {0} · 已做 {1} 题 · 正确率 {2}% · 最高连对 {3} · 冲刺最高 {4}',
    en: 'Puzzle rating {0} · {1} puzzles · {2}% solved · best streak {3} · best storm {4}',
  },
  resetProgress: { zh: '重置谜题进度', en: 'Reset puzzle progress' },
  confirmReset: { zh: '再点一次确认重置', en: 'Tap again to confirm' },
  done: { zh: '完成', en: 'Done' },
  credits: {
    zh: '谜题来自 Lichess 公开题库（CC0），引擎 Stockfish（GPLv3），棋盘 chessground（GPLv3），棋子来自 Lichess（见 pieces/LICENSES.md）。版本 ',
    en: 'Puzzles from the Lichess database (CC0), Stockfish engine (GPLv3), chessground board (GPLv3), pieces from Lichess (see pieces/LICENSES.md). Version ',
  },
} satisfies Record<string, Entry>;

export type Key = keyof typeof S;

/** Translates `key`, replacing {0}, {1}, … with `args`. */
export function t(key: Key, ...args: (string | number)[]): string {
  return S[key][lang].replace(/\{(\d)\}/g, (_, i) => String(args[Number(i)] ?? ''));
}

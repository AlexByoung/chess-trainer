# 棋练 · chess-trainer

自用的国际象棋训练网页：**多步战术谜题**（核心）+ **人机对局**（Stockfish）。纯静态前端，没有后端、账号和统计，所有进度存在浏览器 localStorage 里。主要为 iPad 触屏设计，桌面和手机也能用。

## 功能

- **谜题**：Lichess 公开题库中抽样的 4000 道高人气题（600–2600 分）。对手的第一步自动走（带动画），你走一步、对手 300–500ms 后应答，直到解完。直接将杀的非标准走法也算对；升变时会弹出选择框。走错时棋盘抖动、红圈标记、自动撤回，可以重试或看答案。解对后 0.8 秒自动进入下一题（可在设置里关闭）。Glicko-2 评分（初始 1200），按评分选题，最近做过的题不重复，可按主题筛选。
- **冲刺**：3 分钟限时，题目由易到难，错 3 题结束，记录最高分。
- **对局**：执白 / 执黑 / 随机，6 档难度（约 800–2400）。悔棋、提示箭头、翻转棋盘、局面评估条（默认关）。对局自动保存，刷新后继续。将杀、逼和、三次重复、50 步规则、子力不足都会判定。
- 拖拽和点选两种走法、合法落点提示、上一步和被将军高亮；深色 / 浅色（跟随系统或手动）、3 套棋盘配色；WebAudio 合成音效，可静音。
- 快捷键：`→` 下一题，`H` 提示，`U` 悔棋，`F` 翻转。

## 开发

```bash
npm ci
npm run dev        # 本地开发
npm test           # 单元测试（Vitest）
npm run build      # 类型检查 + 生产构建到 dist/
npm run e2e        # Playwright 冒烟测试（会自动构建并起 preview 服务）
```

`npm run dev/build` 会先把 `node_modules/stockfish` 里的单线程 WASM 版本（`stockfish-18-lite-single`，约 7MB）复制到 `public/engine/`。它在 Web Worker 里运行，不需要 SharedArrayBuffer，也不需要 COOP/COEP 响应头，任何静态托管都能跑。

## 部署

线上地址：<https://alexbyoung.github.io/chess-trainer/>

推送到 `main` 后，GitHub Actions（`.github/workflows/ci.yml`）会依次：跑单元测试 → 构建 → 用 Playwright 对本地构建做冒烟测试 → 部署到 GitHub Pages → 等新版本上线（比对 `version.json` 里的 commit）后，再对线上地址跑一遍同样的 Playwright 测试，包括 Stockfish 应答。

一次性设置：Settings → Pages → Build and deployment → Source 选 **GitHub Actions**（私有仓库需要 GitHub Pro，否则先把仓库设为 Public）。构建用的是相对路径，仓库改名不影响页面。

## 谜题数据

`public/puzzles.json.gz` 由 `scripts/build-puzzles.mjs` 从 [Lichess 谜题库](https://database.lichess.org/#puzzles)（CC0）生成：筛选 Popularity ≥ 90、NbPlays ≥ 1000、RatingDeviation ≤ 90，在 600–2600 分之间每 100 分一档、每档随机抽 200 题，并用 chess.js 回放整条解法确认合法。完整题库不会进入仓库。

重新生成：在 GitHub Actions 里手动运行 **Build puzzle set** 工作流（会在 runner 上下载全库、抽样并提交结果），或在本地：

```bash
curl -fsSL -o puzzles.csv.zst https://database.lichess.org/lichess_db_puzzle.csv.zst
zstd -dc puzzles.csv.zst | node scripts/build-puzzles.mjs --out public/puzzles.json.gz
```

## 技术栈

Vite + TypeScript（不用框架：chessground 本身是命令式 DOM，界面又小，直接写 DOM 更轻）、[chess.js](https://github.com/jhlywa/chess.js) 规则、[chessground](https://github.com/lichess-org/chessground) 棋盘（cburnett 棋子）、[Stockfish.js](https://github.com/nmrugg/stockfish.js) 引擎。

## 许可

GPL-3.0（chessground 和 Stockfish 都是 GPLv3）。谜题数据 CC0。

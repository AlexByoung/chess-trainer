/**
 * Thin UCI client for the single-threaded Stockfish WASM build running in a Web
 * Worker. Searches run one at a time; a newer request cancels the running one.
 */

export interface SearchParams {
  /** Position: FEN of the start plus UCI moves from it. */
  fen?: string;
  moves: string[];
  options: string[];
  movetime?: number;
  depth?: number;
}

export interface SearchResult {
  bestmove: string | null;
  /** Score from White's point of view: centipawns, or mate in N (negative = Black mates). */
  score: { cp?: number; mate?: number } | null;
}

type Listener = (line: string) => void;

const ENGINE_URL = 'engine/stockfish-18-lite-single.js';

export class Engine {
  private worker: Worker | null = null;
  private ready: Promise<void> | null = null;
  private listeners = new Set<Listener>();
  private chain: Promise<unknown> = Promise.resolve();
  private generation = 0;
  private searching = false;

  /** Starts the worker (idempotent). Resolves once the engine answered `readyok`. */
  init(): Promise<void> {
    if (this.ready) return this.ready;
    this.ready = new Promise<void>((resolve, reject) => {
      const url = new URL(ENGINE_URL, document.baseURI);
      const w = new Worker(url);
      this.worker = w;
      w.onmessage = (e: MessageEvent) => {
        const line = typeof e.data === 'string' ? e.data : String(e.data);
        for (const l of this.listeners) l(line);
      };
      w.onerror = (e) => reject(new Error(`Stockfish worker failed: ${e.message}`));
      this.waitFor((l) => l === 'uciok')
        .then(() => {
          this.send('setoption name Hash value 16');
          this.send('isready');
          return this.waitFor((l) => l === 'readyok');
        })
        .then(() => resolve(), reject);
      this.send('uci');
    });
    return this.ready;
  }

  newGame(): void {
    this.generation++;
    this.chain = this.chain.then(async () => {
      await this.init();
      this.send('ucinewgame');
      this.send('isready');
      await this.waitFor((l) => l === 'readyok');
    });
  }

  /** Cancels any running/queued search; their promises resolve with bestmove null. */
  cancel(): void {
    this.generation++;
    if (this.searching) this.send('stop');
  }

  search(p: SearchParams): Promise<SearchResult> {
    const gen = ++this.generation;
    if (this.searching) this.send('stop');
    const run = this.chain.then(() => this.runSearch(p, gen));
    this.chain = run.catch(() => undefined);
    return run;
  }

  private async runSearch(p: SearchParams, gen: number): Promise<SearchResult> {
    await this.init();
    if (gen !== this.generation) return { bestmove: null, score: null };
    for (const o of p.options) this.send(o);
    this.send('isready');
    await this.waitFor((l) => l === 'readyok');
    if (gen !== this.generation) return { bestmove: null, score: null };

    const whiteToMove = sideToMove(p.fen, p.moves.length) === 'w';
    let score: SearchResult['score'] = null;
    const onInfo: Listener = (l) => {
      if (!l.startsWith('info') || !l.includes(' score ')) return;
      if (l.includes(' multipv ') && !l.includes(' multipv 1 ')) return;
      const m = /score (cp|mate) (-?\d+)/.exec(l);
      if (!m) return;
      const v = Number(m[2]) * (whiteToMove ? 1 : -1);
      score = m[1] === 'cp' ? { cp: v } : { mate: v };
    };
    this.listeners.add(onInfo);

    const pos = p.fen ? `position fen ${p.fen}` : 'position startpos';
    this.send(p.moves.length ? `${pos} moves ${p.moves.join(' ')}` : pos);
    const limits = [p.depth ? `depth ${p.depth}` : '', p.movetime ? `movetime ${p.movetime}` : ''].join(' ').trim();
    this.searching = true;
    this.send(`go ${limits || 'movetime 500'}`);
    try {
      const line = await this.waitFor((l) => l.startsWith('bestmove'));
      const best = line.split(' ')[1];
      if (gen !== this.generation) return { bestmove: null, score: null };
      return { bestmove: best && best !== '(none)' ? best : null, score };
    } finally {
      this.searching = false;
      this.listeners.delete(onInfo);
    }
  }

  private send(cmd: string): void {
    this.worker?.postMessage(cmd);
  }

  private waitFor(pred: (line: string) => boolean): Promise<string> {
    return new Promise((resolve) => {
      const l: Listener = (line) => {
        if (pred(line)) {
          this.listeners.delete(l);
          resolve(line);
        }
      };
      this.listeners.add(l);
    });
  }
}

function sideToMove(fen: string | undefined, plies: number): 'w' | 'b' {
  const start = fen ? (fen.split(' ')[1] as 'w' | 'b') : 'w';
  return plies % 2 === 0 ? start : start === 'w' ? 'b' : 'w';
}

export const engine = new Engine();

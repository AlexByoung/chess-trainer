import { expect, type Page } from '@playwright/test';
import { gunzipSync } from 'node:zlib';

export interface StoredPuzzle {
  id: string;
  fen: string;
  moves: string[];
}

let cache: Map<string, StoredPuzzle> | null = null;

/** Reads the same puzzle file the page uses (fetched from the server under test). */
export async function puzzleDb(page: Page): Promise<Map<string, StoredPuzzle>> {
  if (cache) return cache;
  const res = await page.request.get('puzzles.json.gz');
  expect(res.ok()).toBe(true);
  let body = await res.body();
  if (body[0] === 0x1f && body[1] === 0x8b) body = gunzipSync(body);
  const data = JSON.parse(body.toString('utf8')) as { puzzles: [string, string, string, number, string][] };
  cache = new Map(data.puzzles.map(([id, fen, moves]) => [id, { id, fen, moves: moves.split(' ') }]));
  return cache;
}

export async function storage<T>(page: Page, key: string): Promise<T> {
  return page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), key);
}

/** Collects console errors and uncaught exceptions for the page. */
export function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

async function squareCenter(page: Page, sq: string) {
  const box = (await page.locator('#board').boundingBox())!;
  const black = await page.locator('.cg-wrap.orientation-black').count();
  const file = sq.charCodeAt(0) - 97;
  const rank = Number(sq[1]) - 1;
  const col = black ? 7 - file : file;
  const row = black ? rank : 7 - rank;
  const size = box.width / 8;
  return { x: box.x + (col + 0.5) * size, y: box.y + (row + 0.5) * size };
}

/** Clicks (or taps on touch projects) a board square. */
export async function press(page: Page, sq: string) {
  const { x, y } = await squareCenter(page, sq);
  const touch = await page.evaluate(() => matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0);
  if (touch) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

/** Plays a UCI move by selecting the piece and then its destination. */
export async function playMove(page: Page, uci: string) {
  await press(page, uci.slice(0, 2));
  await press(page, uci.slice(2, 4));
  if (uci.length > 4) {
    const choice = page.locator(`.promo-choice[data-role="${uci[4]}"]`);
    await expect(choice).toBeVisible();
    const b = (await choice.boundingBox())!;
    const touch = await page.evaluate(() => navigator.maxTouchPoints > 0);
    if (touch) await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    else await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  }
}

/** Drags a piece with the mouse (desktop only). */
export async function dragMove(page: Page, uci: string) {
  const a = await squareCenter(page, uci.slice(0, 2));
  const b = await squareCenter(page, uci.slice(2, 4));
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 5 });
  await page.mouse.move(b.x, b.y, { steps: 5 });
  await page.mouse.up();
}

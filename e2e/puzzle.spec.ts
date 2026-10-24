import { expect, test, type Page } from '@playwright/test';
import { Chess } from 'chess.js';
import { dragMove, playMove, puzzleDb, storage, trackErrors, type StoredPuzzle } from './helpers';

interface Progress {
  glicko: { rating: number };
  streak: number;
  history: { id: string; solved: boolean }[];
  current: { id: string; ply: number };
}

const progress = (page: Page) => storage<Progress>(page, 'ct.puzzles.v1');

async function currentPuzzle(page: Page): Promise<StoredPuzzle> {
  await expect(page.getByTestId('puzzle-status')).toHaveAttribute('data-phase', 'player');
  const db = await puzzleDb(page);
  return db.get((await progress(page)).current.id)!;
}

/** Plays the stored solution from the player's next move to the end. */
async function solveRest(page: Page, p: StoredPuzzle) {
  const start = (await progress(page)).current.ply;
  for (let i = start; i < p.moves.length; i += 2) {
    await expect.poll(async () => (await progress(page)).current.ply).toBe(i);
    await expect(page.getByTestId('puzzle-status')).toHaveAttribute('data-phase', 'player');
    await playMove(page, p.moves[i]);
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('solves a whole puzzle (opponent auto-moves first) and auto-advances to the next', async ({ page }) => {
  const errors = trackErrors(page);
  const p = await currentPuzzle(page);
  // The opponent's setup move has already been played automatically.
  expect((await progress(page)).current.ply).toBe(1);
  await expect(page.getByTestId('puzzle-difficulty')).not.toBeEmpty();

  await solveRest(page, p);
  await expect(page.getByTestId('puzzle-status')).toContainText('解题成功');
  // Auto-advance after ~0.8 s without pressing anything.
  await expect(page.getByTestId('puzzle-meta')).not.toContainText(`#${p.id}`, { timeout: 4000 });
  await expect(page.getByTestId('puzzle-status')).toContainText('轮到你走');
  await expect(page.getByTestId('puzzle-streak')).toHaveText('1');
  const pr = await progress(page);
  expect(pr.glicko.rating).toBeGreaterThan(1200);
  expect(pr.history[0]).toMatchObject({ id: p.id, solved: true });
  expect(errors).toEqual([]);
});

test('progress survives a reload, including a puzzle in progress', async ({ page }) => {
  const errors = trackErrors(page);
  const p = await currentPuzzle(page);
  await solveRest(page, p);
  await expect(page.getByTestId('puzzle-status')).toContainText('解题成功');
  await expect(page.getByTestId('puzzle-meta')).not.toContainText(`#${p.id}`, { timeout: 4000 });
  const next = await currentPuzzle(page);
  const rating = await page.getByTestId('puzzle-rating').textContent();

  await page.reload();
  await expect(page.getByTestId('puzzle-rating')).toHaveText(rating!);
  await expect(page.getByTestId('puzzle-streak')).toHaveText('1');
  // Same puzzle comes back after the reload.
  await expect(page.getByTestId('puzzle-meta')).toContainText(`#${next.id}`);
  await expect(page.locator('.history .dot.ok')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('a wrong move is marked red, taken back, and the puzzle no longer counts', async ({ page, browserName }, info) => {
  test.skip(info.project.name !== 'desktop', 'drag uses the mouse');
  void browserName;
  const errors = trackErrors(page);
  const p = await currentPuzzle(page);
  const chess = new Chess(p.fen);
  chess.move({ from: p.moves[0].slice(0, 2), to: p.moves[0].slice(2, 4), promotion: p.moves[0][4] });
  const wrong = chess
    .moves({ verbose: true })
    .find((m) => m.lan !== p.moves[1] && !m.promotion && !m.san.includes('#'))!;
  // Count real pieces only: a captured piece fades out during the setup-move animation.
  const pieces = page.locator('cg-board piece:not(.fading):not(.ghost)');
  await expect(page.locator('cg-board piece.fading, cg-board piece.anim')).toHaveCount(0);
  const before = await pieces.count();

  await dragMove(page, wrong.lan);
  await expect(page.getByTestId('puzzle-status')).toContainText('不对');
  // Taken back automatically.
  await expect(pieces).toHaveCount(before);
  expect((await progress(page)).current.ply).toBe(1);
  await expect(page.getByTestId('puzzle-streak')).toHaveText('0');
  expect((await progress(page)).glicko.rating).toBeLessThan(1200);

  await solveRest(page, p);
  await expect(page.getByTestId('puzzle-status')).toContainText('不计分');
  // No auto-advance after a failed puzzle; → moves on.
  await expect(page.getByTestId('next-puzzle')).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('puzzle-meta')).not.toContainText(`#${p.id}`);
  expect(errors).toEqual([]);
});

test('show answer plays the solution', async ({ page }) => {
  const errors = trackErrors(page);
  const p = await currentPuzzle(page);
  await page.getByRole('button', { name: '看答案' }).click();
  await expect(page.getByTestId('puzzle-status')).toContainText('不计分', { timeout: 15_000 });
  expect((await progress(page)).current.ply).toBeGreaterThanOrEqual(p.moves.length);
  expect(errors).toEqual([]);
});

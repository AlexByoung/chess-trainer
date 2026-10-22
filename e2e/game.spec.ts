import { expect, test, type Page } from '@playwright/test';
import { playMove, storage, trackErrors } from './helpers';

const moves = async (page: Page) => (await storage<{ moves: string[] } | null>(page, 'ct.game.v1'))?.moves ?? [];

test('plays against Stockfish, AI replies, and the game survives a reload', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByRole('button', { name: '对局' }).click();
  const dialog = page.getByTestId('new-game-dialog');
  await expect(dialog).toBeVisible();
  await dialog.locator('[data-color="white"]').click();
  await dialog.locator('[data-level="1"]').click();
  await page.getByTestId('start-game').click();

  const status = page.getByTestId('game-status');
  await expect(status).toContainText('轮到你走', { timeout: 30_000 });
  await playMove(page, 'e2e4');
  await expect(status).toContainText('对手思考中');
  await expect.poll(() => moves(page), { timeout: 30_000 }).toHaveLength(2);
  await expect(status).toContainText('轮到你走');
  await expect(page.locator('cg-board square.last-move')).toHaveCount(2);

  // H = engine hint, drawn as an arrow.
  await page.keyboard.press('h');
  await expect(page.locator('svg.cg-shapes line')).toHaveCount(1, { timeout: 15_000 });

  await playMove(page, 'd2d4');
  await expect.poll(() => moves(page), { timeout: 30_000 }).toHaveLength(4);
  const before = await moves(page);
  const list = (await page.getByTestId('move-list').textContent())!;

  await page.reload();
  await expect(page.getByTestId('game-status')).toContainText('轮到你走', { timeout: 30_000 });
  expect(await moves(page)).toEqual(before);
  await expect(page.getByTestId('move-list')).toHaveText(list);

  // U = take back the last move pair.
  await page.keyboard.press('u');
  await expect.poll(() => moves(page)).toHaveLength(2);
  expect(errors).toEqual([]);
});

test('storm mode starts a timed run', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('./');
  await page.getByRole('button', { name: '冲刺' }).click();
  await page.getByTestId('storm-start').click();
  await expect(page.getByTestId('storm-clock')).toHaveText(/^2:5\d$/, { timeout: 15_000 });
  await expect(page.locator('cg-board piece').first()).toBeVisible();
  expect(errors).toEqual([]);
});

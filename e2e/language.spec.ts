import { expect, test } from '@playwright/test';
import { trackErrors } from './helpers';

test('switches the interface to English and remembers it', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByRole('button', { name: '谜题' })).toBeVisible();

  await page.locator('#settings-open').click();
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();

  await expect(page.getByRole('button', { name: 'Puzzles' })).toBeVisible();
  await expect(page.getByTestId('puzzle-status')).toContainText('Your turn');
  await expect(page.getByRole('button', { name: 'Solution' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page.getByTestId('new-game-dialog')).toContainText('Start game');
  await expect(page.getByTestId('new-game-dialog')).toContainText('Intermediate');
  expect(errors).toEqual([]);
});

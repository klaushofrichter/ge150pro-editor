import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { openArrange, returning, slot, watchErrors, writeButton } from './helpers';

test.beforeEach(({ page }) => returning(page));

test('swapping two banks moves all four presets, and Undo puts them back', async ({ page }) => {
  await openArrange(page);
  await page.locator('.bank-title').nth(0).dragTo(page.locator('.bank-title').nth(9));
  await expect(slot(page, 0)).toContainText('Clean 10');
  await expect(slot(page, 39)).toContainText('Lead 1');
  await expect(writeButton(page)).toHaveText(/Write 8 changes/);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(slot(page, 0)).toContainText('Clean 1');
  await expect(writeButton(page)).toHaveText(/Write 0 changes/);
});

test('duplicate and rename ask for a name; a copy is a new preset (N)', async ({ page }) => {
  const errors = watchErrors(page);
  await openArrange(page);
  const answers = ['Clean 1 copy', 'Renamed'];
  page.on('dialog', (d) => d.accept(answers.shift()));
  await slot(page, 0).click();
  await page.getByRole('button', { name: 'Duplicate…' }).click();
  await expect(page.locator('.slot-tools')).toContainText('Click the slot to copy 1A');
  await slot(page, 7).click();
  await expect(slot(page, 7)).toContainText('Clean 1 copy');
  await expect(slot(page, 7).locator('.mark.new')).toHaveText('N');
  await slot(page, 1).click();
  await page.getByRole('button', { name: 'Rename…' }).click();
  await expect(slot(page, 1)).toContainText('Renamed');
  await expect(writeButton(page)).toHaveText(/Write 2 changes/);
  expect(errors).toEqual([]);
});

test('a slot can take a .mo file (picked), shown as a change that Undo takes back', async ({ page }) => {
  await openArrange(page);
  // a .mo exported by the editor itself: the main view's Export .mo of preset 1A
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Tools and USB log' }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export .mo' }).click()]);
  const mo = JSON.parse(readFileSync((await download.path())!, 'utf8'));
  mo.fileInfo.preset_name = 'From a file';
  await page.getByRole('button', { name: 'Arrange and back up presets' }).click();
  await slot(page, 20).click();
  await page.locator('.slot-tools input[type=file]').setInputFiles({ name: 'tone.mo', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(mo)) });
  await expect(slot(page, 20)).toContainText('From a file');
  await expect(page.locator('.message')).toContainText('6A is now "From a file" from tone.mo');
  await expect(writeButton(page)).toHaveText(/Write 1 change/);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(slot(page, 20)).toContainText('Clean 6');
});

test('a stopped write keeps the arrangement: what is left still shows as changes', async ({ page }) => {
  await openArrange(page);
  for (const [a, b] of [[0, 9], [1, 8], [2, 7]]) await page.locator('.bank-title').nth(a).dragTo(page.locator('.bank-title').nth(b));
  await expect(writeButton(page)).toHaveText(/Write 24 changes/);
  await writeButton(page).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Write 24 presets' }).click();
  await page.getByRole('button', { name: 'Stop after this preset' }).click();
  await expect(page.locator('.progress')).toContainText('Stopped.');
  await expect(slot(page, 0)).toContainText('Clean 10'); // the arrangement is still there
  const left = Number((await writeButton(page).textContent())!.match(/Write (\d+)/)![1]);
  expect(left).toBeGreaterThan(0);
  expect(left).toBeLessThan(24);
  await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();
});

test('backups: save one, export it, import it back, and delete both', async ({ page }) => {
  const errors = watchErrors(page);
  await openArrange(page);
  page.on('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Back up the pedal now' }).click();
  const item = page.locator('.backups li').filter({ hasText: 'Pedal' }).first();
  await expect(item).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent('download'), item.getByRole('button', { name: 'Export', exact: true }).click()]);
  expect(download.suggestedFilename()).toMatch(/^GE150PRO Pedal \d{4}-\d\d-\d\d-\d\d-\d\d-\d\d\.json$/);
  const file = readFileSync((await download.path())!);
  await page.locator('input[type=file][accept=".json,application/json"]').setInputFiles({ name: 'my backup.json', mimeType: 'application/json', buffer: file });
  await expect(page.locator('.message')).toContainText('Imported "my backup.json"');
  await expect(page.locator('.backups li')).toHaveCount(2);
  // the imported one holds the same presets: shown, nothing differs from the pedal
  await page.locator('.backups li').nth(1).getByRole('button', { name: 'Show' }).click();
  await expect(writeButton(page)).toHaveText(/Write 0 changes/);
  for (let n = 2; n > 0; n--) {
    await page.locator('.backups li').first().getByRole('button', { name: 'Delete' }).click();
    await expect(page.locator('.backups li .bname')).toHaveCount(n - 1);
  }
  await expect(page.locator('.backups')).toContainText('No backups yet.');
  expect(errors).toEqual([]);
});

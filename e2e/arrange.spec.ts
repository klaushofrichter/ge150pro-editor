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

test('a bank dropped anywhere on another bank swaps the two; the target has a frame while dragging', async ({ page }) => {
  const errors = watchErrors(page);
  await openArrange(page);
  const bank = (b: number) => page.locator('.bank').nth(b);
  await page.locator('.bank-title').nth(1).hover();
  await page.mouse.down();
  await slot(page, 14).hover(); // bank 4, its C slot
  await slot(page, 14).hover({ position: { x: 30, y: 6 } });
  await expect(bank(3)).toHaveClass(/target/);
  await expect(slot(page, 14)).not.toHaveClass(/target/);
  await expect(bank(1)).toHaveClass(/dragged/);
  await page.mouse.up();
  await expect(slot(page, 12)).toContainText('Clean 2');
  await expect(slot(page, 4)).toContainText('Clean 4');
  await expect(page.locator('.bank.target')).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(slot(page, 4)).toContainText('Clean 2');
  expect(errors).toEqual([]);
});

test('a preset is grabbed by its name and swaps with the preset it is dropped on, in its bank or another', async ({ page }) => {
  await openArrange(page);
  await expect(slot(page, 0)).not.toHaveAttribute('draggable', 'true');
  await expect(slot(page, 0).locator('.name')).toHaveAttribute('draggable', 'true');
  // inside the bank
  await slot(page, 0).locator('.name').dragTo(slot(page, 3));
  await expect(slot(page, 0)).toContainText('Lead 1');
  await expect(slot(page, 3)).toContainText('Clean 1');
  // to another bank, with the frame on the slot under the pointer
  await slot(page, 1).locator('.name').hover();
  await page.mouse.down();
  await slot(page, 22).hover();
  await slot(page, 22).hover({ position: { x: 40, y: 6 } });
  await expect(slot(page, 22)).toHaveClass(/target/);
  await page.mouse.up();
  await expect(slot(page, 22)).toContainText('Crunch 1');
  await expect(slot(page, 1)).toContainText('Drive 6');
  await expect(writeButton(page)).toHaveText(/Write 4 changes/);
  await page.getByRole('button', { name: 'Undo' }).click();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(writeButton(page)).toHaveText(/Write 0 changes/);
});

test('dragging to the bottom edge scrolls the list, so a bank far down can be reached', async ({ page }) => {
  await openArrange(page);
  const banks = page.locator('.banks');
  const box = (await banks.boundingBox())!;
  await page.locator('.bank-title').nth(0).hover();
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height - 20, { steps: 4 });
  // keep the pointer there (the browser repeats dragover while it rests) until the list has reached its end
  await expect
    .poll(async () => {
      await page.mouse.move(box.x + box.width / 2 + 1, box.y + box.height - 20);
      await page.mouse.move(box.x + box.width / 2, box.y + box.height - 20);
      return banks.evaluate((el) => el.scrollTop + el.clientHeight >= el.scrollHeight - 2);
    }, { timeout: 15000 })
    .toBe(true);
  await page.locator('.bank-title').nth(49).hover();
  await page.locator('.bank-title').nth(49).hover({ position: { x: 20, y: 5 } });
  await expect(page.locator('.bank').nth(49)).toHaveClass(/target/);
  await page.mouse.up();
  await expect(slot(page, 196)).toContainText('Clean 1');
  await expect(slot(page, 0)).toContainText('Clean 50');
});

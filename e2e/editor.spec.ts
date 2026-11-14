import { expect, test, type Page } from '@playwright/test';

/** Console errors and uncaught exceptions on a page; checked at the end of every test. */
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  return errors;
}

const preset = (page: Page, label: string) => page.locator('.presets li button', { hasText: label });

test('without a pedal, the start page offers the demo', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('./');
  await expect(page.getByRole('link', { name: 'Try the demo' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('the demo shows 200 presets, the effects of the selected one, and the M and N marks', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('./?demo');
  await expect(page.locator('.presets li')).toHaveCount(200);
  await expect(preset(page, '01A')).toContainText('Clean 1');
  await expect(preset(page, '02B').locator('.mark.modified')).toHaveText('M');
  await expect(preset(page, '03B').locator('.mark.new')).toHaveText('N');
  await preset(page, '03D').click();
  await expect(page.locator('.pname')).toHaveText('Lead 3');
  await page.getByRole('button', { name: /^DELAY/ }).click();
  await expect(page.locator('.params h3')).toContainText('DELAY');
  expect(errors).toEqual([]);
});

test('arranging: swap by drag and drop, make a slot empty, undo, and write (demo)', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('./?demo');
  await expect(page.locator('.presets li')).toHaveCount(200);
  await page.getByRole('button', { name: 'Arrange and back up presets' }).click();
  const slot = (i: number) => page.locator('.slot').nth(i);
  await expect(slot(0)).toContainText('Clean 1');

  await slot(0).dragTo(slot(5));
  await expect(slot(5)).toContainText('Clean 1');
  await expect(slot(0)).toContainText('Crunch 2');
  const write = page.getByRole('button', { name: /^Write \d+ changes? to the pedal/ });
  await expect(write).toHaveText(/Write 2 changes/);

  await slot(7).click();
  await page.getByRole('button', { name: 'Make empty' }).click();
  await expect(slot(7)).toHaveClass(/unused/);
  await expect(write).toHaveText(/Write 3 changes/);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(write).toHaveText(/Write 2 changes/);

  await write.click();
  await expect(page.getByRole('alertdialog')).toContainText('Write 2 presets to the pedal?');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Write 2 presets' }).click();
  await expect(page.locator('.progress')).toContainText('Done. 2 presets written and read back.');
  await expect(write).toHaveText(/Write 0 changes/);
  expect(errors).toEqual([]);
});

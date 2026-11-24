import { expect, test } from '@playwright/test';
import { openArrange, preset, returning, slot as slotOf, watchErrors, writeButton } from './helpers';
import { ACCEPTED_KEY, TERMS_VERSION } from './terms';

/** Every test but the first-visit one starts as a returning visitor. */
test.beforeEach(async ({ page }, info) => {
  if (!info.title.startsWith('first visit')) await returning(page);
});

test('first visit: a panel explains the editor and the terms, must be accepted, and the About button shows it again', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('./');
  const panel = page.getByRole('dialog', { name: 'GE150 Pro Editor' });
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('Use at your own risk');
  await expect(panel.getByRole('link', { name: "Mooer's download page" })).toHaveAttribute('href', 'https://www.mooeraudio.com/Downloads_xq/6.html');
  await expect(panel.getByRole('link', { name: 'Mooer GE150 Pro' })).toHaveAttribute('href', 'https://www.mooeraudio.com/products/207.html');
  await expect(panel.getByRole('link', { name: /github\.com\/klaushofrichter\/ge150pro-editor/ })).toBeVisible();
  await expect(panel).toContainText("Read the factory presets from Mooer's download");
  await expect(panel.getByRole('link', { name: 'terms of use' })).toHaveAttribute('href', './terms.html');
  // only accepting closes it
  await page.keyboard.press('Escape');
  await page.mouse.click(5, 5);
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: 'I agree to the terms of use and accept the risk' }).click();
  await expect(panel).toBeHidden();
  expect(await page.evaluate((k) => localStorage.getItem(k), ACCEPTED_KEY)).toBe(TERMS_VERSION);
  await page.reload();
  await expect(page.getByRole('link', { name: 'Try the demo' })).toBeVisible();
  await expect(panel).toBeHidden();
  // the About button shows it again, now as a plain dialog
  await page.getByRole('button', { name: 'About, factory presets and terms of use' }).click();
  await expect(panel).toBeVisible();
  await expect(panel.getByText(/^Version /)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await page.getByRole('button', { name: 'About, factory presets and terms of use' }).click();
  await panel.getByRole('button', { name: 'Close' }).click();
  await expect(panel).toBeHidden();
  expect(errors).toEqual([]);
});

test('first visit in a browser session without a pedal: the About panel opens, closes, and stays closed on a reload', async ({ page }) => {
  const errors = watchErrors(page);
  await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [ACCEPTED_KEY, TERMS_VERSION]);
  await page.goto('./');
  const panel = page.getByRole('dialog', { name: 'GE150 Pro Editor' });
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: 'Close' }).click();
  await expect(panel).toBeHidden();
  await page.reload();
  await expect(page.getByRole('link', { name: 'Try the demo' }).first()).toBeVisible();
  await expect(panel).toBeHidden();
  expect(errors).toEqual([]);
});

test('first visit in a browser session with the demo: no About panel', async ({ page }) => {
  await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [ACCEPTED_KEY, TERMS_VERSION]);
  await page.goto('./?demo');
  await expect(page.locator('.presets li')).toHaveCount(200);
  await expect(page.getByRole('dialog', { name: 'GE150 Pro Editor' })).toBeHidden();
});

test('first visit after the terms changed: the panel shows again', async ({ page }) => {
  await page.addInitScript((k) => localStorage.setItem(k, '2000-01-01'), ACCEPTED_KEY);
  await page.goto('./');
  await expect(page.getByRole('button', { name: 'I agree to the terms of use and accept the risk' })).toBeVisible();
});

test('the terms of use have a page of their own, from TERMS.md', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('./terms.html');
  await expect(page.getByRole('heading', { name: 'Terms of use', level: 1 })).toBeVisible();
  await expect(page.locator('main')).toContainText('No liability');
  await expect(page.locator('main')).toContainText('"as is"');
  expect(await page.evaluate(() => document.documentElement.dataset.termsVersion)).toBe(TERMS_VERSION);
  await page.getByRole('link', { name: '← GE150 Pro Editor' }).first().click();
  await expect(page).toHaveURL(/\/$/);
  expect(errors).toEqual([]);
});

test("the factory presets come from Mooer's download: the Arrange dialog takes .zip, .dmg and .mr", async ({ page }) => {
  await page.goto('./?demo');
  await page.getByRole('button', { name: 'Arrange and back up presets' }).click();
  const input = page.locator('input[type=file][accept=".zip,.dmg,.mr"]');
  await expect(input).toHaveCount(1);
  // where to get it: Mooer's download page, and Mooer's home page in case that link moved
  const hint = page.locator('.download-hint');
  await expect(hint.getByRole('link', { name: "Mooer's download page" })).toHaveAttribute('href', 'https://www.mooeraudio.com/Downloads_xq/6.html');
  await expect(hint.getByRole('link', { name: 'mooeraudio.com' })).toHaveAttribute('href', 'https://www.mooeraudio.com');
  await expect(hint.getByRole('link', { name: 'mooeraudio.com' })).toHaveAttribute('target', '_blank');
  await input.setInputFiles({ name: 'something.zip', mimeType: 'application/zip', buffer: Buffer.from('PK\u0003\u0004 not really a zip') });
  await expect(page.locator('.message')).toContainText('the factory presets were not found in this file');
});

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
  await openArrange(page);
  const slot = (i: number) => slotOf(page, i);

  await slot(0).dragTo(slot(5));
  await expect(slot(5)).toContainText('Clean 1');
  await expect(slot(0)).toContainText('Crunch 2');
  const write = writeButton(page);
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

test('a narrow desktop window is not a phone: no desktop-only notice', async ({ page }) => {
  await page.setViewportSize({ width: 500, height: 800 });
  await page.goto('./?demo');
  await expect(page.locator('.presets li')).toHaveCount(200);
  await expect(page.getByText('Desktop only')).toHaveCount(0);
});

import { expect, test } from '@playwright/test';
import { preset, returning, watchErrors } from './helpers';

test.beforeEach(({ page }) => returning(page));

test('editing a module marks the preset as changed, and Revert brings back the stored sound', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('./?demo');
  await preset(page, '02A').click();
  await expect(page.locator('.pname')).toHaveText('Clean 2');
  await page.getByRole('button', { name: /^AMP/ }).click();
  const gain = page.locator('.params input[type=range]').first();
  const before = await gain.inputValue();
  await page.getByRole('button', { name: /^Increase / }).first().click();
  await expect(gain).not.toHaveValue(before);
  await expect(page.locator('.pname')).toHaveText('Clean 2 *');
  await expect(page.locator('.banner')).toContainText('Changes are live on the device');
  await page.getByRole('button', { name: 'Tools and USB log' }).click();
  await page.getByRole('button', { name: 'Revert unsaved changes' }).click();
  await expect(page.locator('.pname')).toHaveText('Clean 2');
  await expect(gain).toHaveValue(before);
  expect(errors).toEqual([]);
});

test('switching to another preset shows its own stored sound, not the edit', async ({ page }) => {
  await page.goto('./?demo');
  await preset(page, '04A').click();
  await page.getByRole('button', { name: /^AMP/ }).click();
  await page.getByRole('button', { name: /^Increase / }).first().click();
  await expect(page.locator('.pname')).toHaveText('Clean 4 *');
  await page.getByRole('button', { name: 'Next preset' }).click();
  await expect(page.locator('.pname')).toHaveText('Crunch 4');
  await page.getByRole('button', { name: 'Previous preset' }).click();
  await expect(page.locator('.pname')).toHaveText('Clean 4'); // the unsaved edit is gone, as on the pedal
});

test('the terms page opens from the intro panel link and leads back to the editor', async ({ page, context }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'About, factory presets and terms of use' }).click();
  const [terms] = await Promise.all([context.waitForEvent('page'), page.getByRole('link', { name: 'terms of use' }).click()]);
  await expect(terms.getByRole('heading', { name: 'Terms of use', level: 1 })).toBeVisible();
  await expect(terms.locator('main')).toContainText('You use it at your own risk');
});

test('the EXP box shows the pedal mode, and switching FUNCTION here is an edit of the preset', async ({ page }) => {
  await page.goto('./?demo');
  await preset(page, '01A').click(); // Clean 1: FUNCTION off, EXP VOL off
  const chip = page.locator('.exp .chip');
  await expect(chip).toHaveText('OFF');
  await page.locator('.exp').click();
  await page.locator('label[title="EXP volume"]').click();
  await expect(chip).toHaveText('VOL');
  await page.locator('label[title="EXP function"]').click();
  await expect(chip).toHaveText('EXP');
  await expect(page.locator('.pname')).toHaveText('Clean 1 *');
});

test('the tools panel has a Clear USB log button, disabled while the log is empty', async ({ page }) => {
  await page.goto('./?demo');
  await page.getByRole('button', { name: 'Tools and USB log' }).click();
  await expect(page.getByRole('button', { name: 'Clear USB log' })).toBeDisabled();
});

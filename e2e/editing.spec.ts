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
  const ask = page.getByRole('dialog', { name: 'Unsaved changes' });
  await expect(ask).toContainText('"Clean 4" has unsaved changes. Switching to 04B discards them');
  await ask.getByRole('button', { name: 'Discard and switch' }).click();
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
  await page.locator('label[title="Volume mode on"]').click();
  await expect(chip).toHaveText('VOL');
  await page.locator('label[title="Start in EXP mode"]').click();
  await expect(chip).toHaveText('EXP');
  await expect(page.locator('.pname')).toHaveText('Clean 1 *');
});

test('EXP window: mode now is playing, the active mode is highlighted, and the on-screen pedal plays in EXP mode', async ({ page }) => {
  await page.goto('./?demo');
  await preset(page, '01A').click(); // Clean 1: starts in volume mode
  await page.locator('.exp').click();
  const now = page.getByRole('radiogroup', { name: 'Mode now (toe switch)' });
  const exp = page.locator('section', { has: page.getByRole('heading', { name: 'EXP mode' }) });
  const vol = page.locator('section', { has: page.getByRole('heading', { name: 'Volume mode' }) });
  await expect(vol).toHaveClass(/active/);
  await expect(page.getByLabel('Expression pedal position')).toBeDisabled();
  await now.getByRole('radio', { name: 'EXP' }).click();
  await expect(exp).toHaveClass(/active/);
  await expect(vol).not.toHaveClass(/active/);
  const pedal = page.getByLabel('Expression pedal position');
  await expect(pedal).toBeEnabled();
  await pedal.focus();
  await page.keyboard.press('Home');
  await expect(exp.locator('.live output')).not.toHaveText('');
  await expect(page.locator('.pname')).toHaveText('Clean 1'); // playing, not an edit
  await now.getByRole('radio', { name: 'VOLUME' }).click();
  await expect(vol).toHaveClass(/active/);
  await expect(page.locator('.pname')).toHaveText('Clean 1');
});

test('Review differences shows what differs from the original, and restores the original or the last saved state', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('./?demo');
  await preset(page, '02B').click(); // Crunch 2: modified (M), the demo's original has another AMP GAIN
  await expect(page.locator('.pname')).toHaveText('Crunch 2');
  await page.getByRole('button', { name: 'Review differences' }).click();
  const dialog = page.getByRole('dialog', { name: 'DIFFERENCES' });
  await expect(dialog.locator('tbody tr').first()).toContainText('GAIN');
  await dialog.getByRole('button', { name: 'Restore original' }).click();
  await expect(dialog).toContainText('Same sound as the original 2B');
  await expect(page.locator('.pname')).toHaveText('Crunch 2 *'); // unsaved until Save
  await expect(dialog.getByRole('button', { name: 'Restore original' })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Restore last saved' }).click();
  await expect(page.locator('.pname')).toHaveText('Crunch 2');
  await expect(dialog).toContainText('None: the preset is as last saved.');
  await expect(dialog.locator('tbody tr').first()).toContainText('GAIN');
  expect(errors).toEqual([]);
});

test('Save under the current name stores the restored original in the same slot, after asking', async ({ page }) => {
  await page.goto('./?demo');
  await preset(page, '02B').click();
  await page.getByRole('button', { name: 'Review differences' }).click();
  const dialog = page.getByRole('dialog', { name: 'DIFFERENCES' });
  await dialog.getByRole('button', { name: 'Restore original' }).click();
  page.once('dialog', (d) => d.dismiss());
  await dialog.getByRole('button', { name: 'Save under the current name' }).click();
  await expect(page.locator('.pname')).toHaveText('Crunch 2 *'); // declined: nothing stored
  page.once('dialog', (d) => {
    expect(d.message()).toContain('02B "Crunch 2"');
    void d.accept();
  });
  await dialog.getByRole('button', { name: 'Save under the current name' }).click();
  await expect(dialog.getByRole('status')).toHaveText('Saved to 02B "Crunch 2".');
  await expect(page.locator('.pname')).toHaveText('Crunch 2');
  await expect(preset(page, '02B').locator('.mark')).toHaveCount(0); // no longer modified
});

test('an unsaved change marks the preset M at once; Revert takes the mark away', async ({ page }) => {
  await page.goto('./?demo');
  await preset(page, '02A').click(); // Clean 2: an original preset
  await expect(preset(page, '02A').locator('.mark')).toHaveCount(0);
  await page.getByRole('button', { name: /^AMP/ }).click();
  await page.locator('.params input[type=range]').first().press('ArrowRight');
  await expect(preset(page, '02A').locator('.mark')).toHaveText('M');
  await page.getByRole('button', { name: 'Review differences' }).click();
  await page.getByRole('dialog', { name: 'DIFFERENCES' }).getByRole('button', { name: 'Restore last saved' }).click();
  await expect(preset(page, '02A').locator('.mark')).toHaveCount(0);
});

test('the chain buttons explain their step on hover, and a preset with unsaved changes is marked M', async ({ page }) => {
  await page.goto('./?demo');
  await preset(page, '03B').click(); // My Tone: new (N), not an original
  await expect(page.getByRole('button', { name: /^AMP/ })).toHaveAttribute('title', /^3 of 9 · AMP: The amp model/);
  await expect(preset(page, '03B').locator('.mark')).toHaveText(['N']);
  await page.getByRole('button', { name: /^AMP/ }).click();
  await page.locator('.params input[type=range]').first().press('ArrowRight');
  await expect(preset(page, '03B').locator('.mark')).toHaveText(['N', 'M']);
  await expect(preset(page, '03B').locator('.mark.modified')).toHaveAttribute('title', /Unsaved changes/);
});

test('clicking the current preset with unsaved changes offers to reload it, not to switch', async ({ page }) => {
  await page.goto('./?demo');
  await preset(page, '02A').click();
  await page.getByRole('button', { name: /^AMP/ }).click();
  await page.locator('.params input[type=range]').first().press('ArrowRight');
  await expect(page.locator('.pname')).toHaveText('Clean 2 *');
  await preset(page, '02A').click();
  const ask = page.getByRole('dialog', { name: 'Unsaved changes' });
  await expect(ask).toContainText('Reloading 02A discards them');
  await ask.getByRole('button', { name: 'Discard and reload' }).click();
  await expect(page.locator('.pname')).toHaveText('Clean 2');
});

test('without a pedal (and not in the demo) a warning says so', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.pedal-notice')).toContainText('The pedal is not connected.');
  await page.goto('./?demo');
  await expect(page.locator('.pname')).not.toHaveText('');
  await expect(page.locator('.pedal-notice')).toBeHidden();
});

test('an original preset has no Review differences button until it is changed', async ({ page }) => {
  await page.goto('./?demo');
  await preset(page, '02A').click();
  await expect(page.locator('.pname')).toHaveText('Clean 2');
  await expect(page.getByRole('button', { name: 'Review differences' })).toBeHidden();
});

test('the tools panel has a Clear USB log button, disabled while the log is empty', async ({ page }) => {
  await page.goto('./?demo');
  await page.getByRole('button', { name: 'Tools and USB log' }).click();
  await expect(page.getByRole('button', { name: 'Clear USB log' })).toBeDisabled();
});

test('switching with unsaved changes asks first: Cancel stays, Save and switch stores and goes on', async ({ page }) => {
  await page.goto('./?demo');
  await preset(page, '05A').click();
  await page.getByRole('button', { name: /^AMP/ }).click();
  await page.getByRole('button', { name: /^Increase / }).first().click();
  await expect(page.locator('.pname')).toHaveText('Clean 5 *');
  await preset(page, '06A').click();
  const ask = page.getByRole('dialog', { name: 'Unsaved changes' });
  await ask.getByRole('button', { name: 'Cancel' }).click();
  await expect(ask).toBeHidden();
  await expect(page.locator('.pname')).toHaveText('Clean 5 *'); // still there, still unsaved
  page.once('dialog', (d) => d.accept()); // the name prompt of Save
  await preset(page, '06A').click();
  await ask.getByRole('button', { name: 'Save and switch' }).click();
  await expect(page.locator('.pname')).toHaveText('Clean 6');
});

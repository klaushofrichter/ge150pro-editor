import { expect, test } from '@playwright/test';

// The README's screenshots, from the demo (made-up presets): npm run screenshots
const out = (name: string) => `docs/screenshots/${name}.png`;

test('editor', async ({ page }) => {
  await page.goto('./?demo');
  await page.locator('.presets li button', { hasText: '04D' }).click();
  await page.getByRole('button', { name: /^AMP/ }).click();
  await expect(page.locator('.pname')).toHaveText('Lead 4');
  await page.screenshot({ path: out('editor') });
});

test('arrange', async ({ page }) => {
  await page.goto('./?demo');
  await page.getByRole('button', { name: 'Arrange and back up presets' }).click();
  const slot = (i: number) => page.locator('.slot').nth(i);
  await slot(0).dragTo(slot(13));
  await page.locator('.bank-title').nth(2).dragTo(page.locator('.bank-title').nth(6));
  await slot(19).click();
  await page.getByRole('button', { name: 'Make empty' }).click();
  await slot(20).click();
  await expect(page.getByRole('button', { name: /^Write 11 changes/ })).toBeVisible();
  await page.screenshot({ path: out('arrange') });
});

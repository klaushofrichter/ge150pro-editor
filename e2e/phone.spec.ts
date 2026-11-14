import { expect, test } from '@playwright/test';

// On a phone (touch only, small screen) the editor shows a notice instead; "Show it anyway" opens it for this visit.
test('a phone gets the desktop-only notice, and can still open the editor', async ({ page }) => {
  await page.goto('./?demo');
  await expect(page.getByRole('heading', { name: 'GE150 Pro Editor', level: 1 })).toBeVisible();
  await expect(page.getByText('Desktop only')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Terms of use' })).toHaveAttribute('href', './terms.html');
  await expect(page.locator('.presets')).toHaveCount(0);
  await page.getByRole('button', { name: 'Show it anyway' }).click();
  // the editor, with the intro panel of a first visit
  await expect(page.getByRole('dialog', { name: 'GE150 Pro Editor' })).toBeVisible();
  await expect(page.locator('.presets li')).toHaveCount(200);
});

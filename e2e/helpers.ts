// Shared by the browser tests: console-error watching, a returning visitor, the preset list and the Arrange dialog.
import { expect, type Page } from '@playwright/test';
import { ACCEPTED_KEY, TERMS_VERSION } from './terms';

/** Console errors and uncaught exceptions on a page; checked at the end of a test. */
export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  return errors;
}

/** A visitor who has accepted the terms (no intro panel). */
export const returning = (page: Page) => page.addInitScript(([k, v]) => localStorage.setItem(k, v), [ACCEPTED_KEY, TERMS_VERSION]);

export const preset = (page: Page, label: string) => page.locator('.presets li button', { hasText: label });

/** The demo, loaded, with the Arrange dialog open. */
export async function openArrange(page: Page) {
  await page.goto('./?demo');
  await expect(page.locator('.presets li')).toHaveCount(200);
  await page.getByRole('button', { name: 'Arrange and back up presets' }).click();
  await expect(page.locator('.slot').first()).toContainText('Clean 1');
}

export const slot = (page: Page, i: number) => page.locator('.slot').nth(i);
export const writeButton = (page: Page) => page.getByRole('button', { name: /^Write \d+ changes? to the pedal/ });

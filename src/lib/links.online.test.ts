// The Mooer pages the editor links to still answer, and still say what the editor tells people to find there. Runs
// against the real site (npm run test:links), daily and on pull requests in links.yml; not part of npm test.
import { describe, expect, it } from 'vitest';
import { MOOER_DOWNLOADS, MOOER_HOME, MOOER_PRODUCT } from './links';

async function page(url: string) {
  const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20000) });
  return { status: res.status, url: res.url, text: await res.text() };
}

describe('Mooer links', { retry: 2, timeout: 30000 }, () => {
  it('the home page answers and leads to the GE150 Pro', async () => {
    const p = await page(MOOER_HOME);
    expect(p.status).toBe(200);
    expect(p.text).toMatch(/GE150 Pro/i);
  });

  it('the download page answers and offers the GE150 Pro package for Mac', async () => {
    const p = await page(MOOER_DOWNLOADS);
    expect(p.status).toBe(200);
    expect(p.text).toMatch(/GE150 Pro/i);
    // the About panel and the Arrange dialog tell people to get the package for Mac (a .zip)
    expect(p.text).toMatch(/ge150_pro_v[\d.]+_mac\.zip/i);
  });

  it('the product page answers and is the GE150 Pro', async () => {
    const p = await page(MOOER_PRODUCT);
    expect(p.status).toBe(200);
    expect(p.text).toMatch(/GE150 Pro/i);
  });
});

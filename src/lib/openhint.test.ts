import { describe, expect, it } from 'vitest';
import { openHint } from './store.svelte';

describe('openHint', () => {
  it('names the udev rule on desktop Linux only', () => {
    expect(openHint('Mozilla/5.0 (X11; Linux x86_64) Chrome/142')).toMatch(/udev rule/);
    expect(openHint('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/142')).toMatch(/in use/);
    expect(openHint('Mozilla/5.0 (X11; CrOS x86_64) Chrome/142')).not.toMatch(/udev/);
  });
});

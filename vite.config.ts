/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  base: './',
  // unit tests only; the browser tests in e2e/ run with Playwright
  test: { include: ['src/**/*.test.ts'] },
});

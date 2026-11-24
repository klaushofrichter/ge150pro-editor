/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  base: './',
  // two pages: the app, and the terms of use on a page of their own
  build: { rollupOptions: { input: { main: 'index.html', terms: 'terms.html' } } },
  // unit tests only; the browser tests in e2e/ run with Playwright. *.online.test.ts reach real websites and run only
  // with ONLINE=1 (npm run test:links)
  test: process.env.ONLINE ? { include: ['src/**/*.online.test.ts'] } : { include: ['src/**/*.test.ts'], exclude: ['**/*.online.test.ts', '**/node_modules/**'] },
});

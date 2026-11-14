/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  base: './',
  // two pages: the app, and the terms of use on a page of their own
  build: { rollupOptions: { input: { main: 'index.html', terms: 'terms.html' } } },
  // unit tests only; the browser tests in e2e/ run with Playwright
  test: { include: ['src/**/*.test.ts'] },
});

import { mount } from 'svelte';
import App from './App.svelte';
import './app.css';

mount(App, { target: document.getElementById('app')! });

// Dev builds only: expose state for protocol investigation from the browser console.
if (import.meta.env.DEV) {
  import('./lib/store.svelte').then(({ editor }) => ((window as unknown as { ge150: unknown }).ge150 = editor));
}

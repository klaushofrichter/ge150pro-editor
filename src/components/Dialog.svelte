<script lang="ts">
  import type { Snippet } from 'svelte';

  let { title, onclose, footer, children }: { title: string; onclose: () => void; footer?: string; children: Snippet } = $props();
  const id = $derived(`dlg-${title.toLowerCase().replace(/\W+/g, '-')}`);
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />
<div class="backdrop" role="presentation" onclick={onclose}></div>
<div class="dialog" role="dialog" aria-modal="true" aria-labelledby={id}>
  <header>
    <h2 {id}>{title}</h2>
    <button class="close" aria-label="Close" onclick={onclose}>✕</button>
  </header>
  {@render children()}
  {#if footer}<footer class="muted">{footer}</footer>{/if}
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 0.5);
    z-index: 10;
  }
  .dialog {
    position: fixed;
    z-index: 11;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(760px, calc(100vw - 32px));
    max-height: calc(100vh - 48px);
    overflow-y: auto;
    background: var(--panel);
    border-radius: 8px;
    padding: 20px 32px 16px;
    box-shadow: 0 10px 40px rgb(0 0 0 / 0.6);
  }
  header {
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    margin-bottom: 8px;
  }
  h2 {
    margin: 0;
    font-weight: 500;
    font-size: 1.5rem;
  }
  .close {
    position: absolute;
    right: 0;
    background: none;
    border: none;
    color: var(--text);
    font-size: 1.3rem;
    cursor: pointer;
  }
  /* Shared building blocks for dialog content. */
  .dialog :global(section) {
    border-top: 1px solid var(--line);
    padding: 16px 0;
  }
  .dialog :global(section:first-of-type) {
    border-top: none;
  }
  .dialog :global(h3) {
    margin: 0;
    font-weight: 500;
    font-size: 1.15rem;
    min-width: 9.5rem;
  }
  .dialog :global(.inline) {
    display: flex;
    align-items: center;
    gap: 18px;
    flex-wrap: wrap;
  }
  .dialog :global(.rows) {
    display: flex;
    flex-direction: column;
    gap: 14px;
    margin-top: 12px;
  }
  .dialog :global(.rows.dim) {
    opacity: 0.6;
  }
  .dialog :global(.btn) {
    background: var(--well);
    color: var(--text);
    border: 1px solid #1a1a1c;
    padding: 8px 22px;
    border-radius: 3px;
    cursor: pointer;
    font: inherit;
  }
  .dialog :global(.btn.selected) {
    color: var(--accent);
    border-color: var(--accent);
  }
  .dialog :global(.muted) {
    color: var(--muted);
  }
  footer {
    border-top: 1px solid var(--line);
    padding-top: 10px;
    font-size: 0.85rem;
  }
  @media (max-width: 640px) {
    .dialog {
      padding: 16px;
    }
  }
</style>

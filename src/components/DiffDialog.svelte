<script lang="ts">
  // The current preset compared with the original preset of the same name and with its last saved state, with a
  // way back to either. Restoring the original makes unsaved edits (Save keeps them); restoring the saved state is
  // Revert.
  import { editor } from '../lib/store.svelte';
  import { presetDiff, type DiffRow } from '../lib/diff';
  import { presetLabel } from '../lib/protocol/preset';
  import Dialog from './Dialog.svelte';

  let { onclose }: { onclose: () => void } = $props();

  const original = $derived(editor.originalPreset);
  const saved = $derived(editor.live ? editor.presets[editor.live.index - 1] : null);
  const vsOriginal = $derived(original && editor.live ? presetDiff(original, editor.live) : []);
  const vsSaved = $derived(saved && editor.live && editor.dirty ? presetDiff(saved, editor.live) : []);
</script>

{#snippet table(rows: DiffRow[], left: string, right: string)}
  <table>
    <thead><tr><th>Module</th><th>Setting</th><th>{left}</th><th>{right}</th></tr></thead>
    <tbody>
      {#each rows as r, i (i)}
        <tr><td>{r.section}</td><td>{r.setting}</td><td>{r.original}</td><td class="now">{r.now}</td></tr>
      {/each}
    </tbody>
  </table>
{/snippet}

<Dialog title="DIFFERENCES" wide {onclose} footer="Restore original loads the original's settings as unsaved changes: they play right away, and Save stores them. Restore last saved discards unsaved changes.">
  {#if !editor.live}
    <p class="muted">Select a preset first.</p>
  {:else}
    <p class="muted">{presetLabel(editor.live.index)} · {editor.live.name}</p>
    <section>
      <div class="inline">
        <h3>Compared with the original</h3>
        <button class="btn" disabled={!original || !vsOriginal.length || !editor.online || editor.busy} onclick={() => editor.restoreOriginal()}>Restore original</button>
      </div>
      {#if !original}
        <p class="muted">The original set has no preset with this name.</p>
      {:else if !vsOriginal.length}
        <p class="muted">Same sound as the original {presetLabel(original.index)}.</p>
      {:else}
        <p class="muted">The original is {presetLabel(original.index)} in the original set.</p>
        {@render table(vsOriginal, 'Original', 'Now')}
      {/if}
    </section>
    <section>
      <div class="inline">
        <h3>Unsaved changes</h3>
        <button class="btn" disabled={!editor.dirty || editor.busy} onclick={() => editor.revert()}>Restore last saved</button>
      </div>
      {#if !editor.dirty}
        <p class="muted">None: the preset is as last saved.</p>
      {:else if !vsSaved.length}
        <p class="muted">Changed and changed back: the sound is as last saved.</p>
      {:else}
        {@render table(vsSaved, 'Saved', 'Now')}
      {/if}
    </section>
  {/if}
</Dialog>

<style>
  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 10px;
    font-variant-numeric: tabular-nums;
  }
  th,
  td {
    text-align: left;
    padding: 5px 10px;
    border-bottom: 1px solid var(--line);
  }
  th {
    font-weight: 500;
    color: var(--muted, inherit);
  }
  .now {
    color: var(--accent);
  }
  section p {
    margin: 8px 0 0;
  }
</style>

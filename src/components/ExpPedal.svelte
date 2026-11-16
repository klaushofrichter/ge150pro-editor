<script lang="ts">
  // The expression pedal on screen: its position (the value of the parameter it moves), draggable like the pedal, and
  // the EXP LED (the mode is switched in the panel). Both are playing, not edits. In volume mode the pedal reports nothing, so there is no position.
  import { editor } from '../lib/store.svelte';
  import { expTarget, formatValue, rawRange } from '../lib/catalog';

  const live = $derived(editor.live);
  const target = $derived(live ? expTarget(live.exp, live.modules) : null);
  const spec = $derived(target?.spec);
  const range = $derived(spec ? rawRange(spec) : ([0, 0] as [number, number]));
  const raw = $derived(spec && live && target ? live.modules[target.slot].values[spec.pos] : 0);
  const expMode = $derived(editor.expMode === 1);
  const volOn = $derived(live?.exp.VOL_SWITCH === 1);
  const active = $derived(expMode && !!spec && editor.online);
  const fill = $derived(range[1] > range[0] ? ((raw - range[0]) / (range[1] - range[0])) * 100 : 0);
</script>

<div class="pedal" class:vol={!expMode}>
  <div class="body" style="--fill: {active ? fill : 0}%">
    <input
      type="range"
      aria-label="Expression pedal position"
      min={range[0]}
      max={range[1]}
      value={raw}
      disabled={!active}
      oninput={(e) => editor.playExp(Number(e.currentTarget.value))}
    />
    {#if live && !expMode}<span class="unknown" aria-hidden="true">{volOn ? 'Not reported in volume mode' : 'Volume mode is off'}</span>{/if}
  </div>
  <div class="readout" aria-live="polite">
    {#if !live}
      –
    {:else if expMode}
      {#if spec}<strong>{formatValue(spec, raw)}</strong><span class="muted">{target?.name}</span>{:else}<span class="muted">no {target?.name ?? 'parameter'} here</span>{/if}
    {:else}
      <span class="muted">{volOn ? 'The pedal does not report its position in volume mode' : 'The pedal does nothing in volume mode'}</span>
    {/if}
  </div>
  <span class="toe" class:lit={expMode} title="The EXP LED: lit in EXP mode">
    <span class="led" aria-hidden="true"></span>
    {expMode ? 'EXP' : volOn ? 'VOLUME' : 'VOLUME (off)'}
  </span>
</div>

<style>
  .pedal {
    display: grid;
    justify-items: center;
    gap: 10px;
    width: 9rem;
  }
  .body {
    position: relative;
    width: 5.5rem;
    height: 11rem;
    border-radius: 14px 14px 8px 8px;
    background: linear-gradient(to top, var(--accent) var(--fill), var(--well) var(--fill));
    border: 2px solid var(--line);
    overflow: hidden;
  }
  .vol .body {
    background: repeating-linear-gradient(-45deg, var(--well) 0 8px, var(--line) 8px 16px);
  }
  .unknown {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    padding: 8px;
    text-align: center;
    font-size: 0.8rem;
    font-weight: 600;
    line-height: 1.3;
    pointer-events: none;
    color: var(--text);
    text-shadow: 0 0 4px var(--panel), 0 0 8px var(--panel);
  }
  .body input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    writing-mode: vertical-lr;
    direction: rtl;
    opacity: 0;
    cursor: ns-resize;
  }
  .body input:disabled {
    cursor: default;
  }
  .body:has(input:focus-visible) {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .readout {
    display: grid;
    justify-items: center;
    min-height: 2.6em;
    text-align: center;
    font-size: 0.9rem;
    font-variant-numeric: tabular-nums;
  }
  .toe {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 14px;
    border-radius: 999px;
    font-weight: 600;
  }
  .led {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--line);
  }
  .toe.lit .led {
    background: var(--accent);
    box-shadow: 0 0 6px var(--accent);
  }
</style>

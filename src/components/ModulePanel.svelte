<script lang="ts">
  import { catalog, formatValue, rawFraction, rawRange, type ParamSpec } from '../lib/catalog';
  import type { ModuleState } from '../lib/protocol/preset';
  import Toggle from './Toggle.svelte';

  let { slot, mod, onchange }: { slot: number; mod: ModuleState; onchange: (m: ModuleState) => void } = $props();

  const slotCatalog = $derived(catalog.slots[slot]);
  const model = $derived(slotCatalog.models[mod.type]);
  const pad = (n: number) => String(n).padStart(2, '0');

  function setValue(p: ParamSpec, raw: number) {
    const [min, max] = rawRange(p);
    const values = [...mod.values];
    values[p.pos] = Math.max(min, Math.min(max, raw));
    if (values[p.pos] !== mod.values[p.pos]) onchange({ ...mod, values });
  }

  let list: HTMLOListElement | undefined = $state();
  $effect(() => {
    // Keep the selected model visible when the preset or module changes.
    list?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  });
</script>

<div class="panel">
  <div class="models">
    <div class="models-head">
      <h2>{slotCatalog.name}</h2>
      <Toggle checked={mod.on} label="{slotCatalog.name} on" onchange={(on) => onchange({ ...mod, on })} />
    </div>
    <ol bind:this={list} role="listbox" aria-label="{slotCatalog.name} models">
      {#each slotCatalog.models as m (m.index)}
        <li role="option" aria-selected={m.index === mod.type}>
          <button onclick={() => onchange({ ...mod, type: m.index })}>
            {pad(m.index + 1)}: {m.name}
          </button>
        </li>
      {/each}
    </ol>
  </div>

  <div class="params">
    <h3>{slotCatalog.name} &nbsp;-&nbsp; {model ? `${pad(mod.type + 1)}: ${model.name}` : `unknown model ${mod.type}`}</h3>

    <div class="sliders">
      {#each model?.params ?? [] as p, i (p.name)}
        <div class="param">
          <label for="p-{slot}-{i}">{p.name}</label>
          {#if p.kind === 'enum'}
            <select id="p-{slot}-{i}" value={mod.values[p.pos]} onchange={(e) => setValue(p, Number(e.currentTarget.value))}>
              {#each p.options as opt, oi (oi)}
                <option value={oi}>{opt}</option>
              {/each}
            </select>
          {:else}
            <input
              id="p-{slot}-{i}"
              type="range"
              min={rawRange(p)[0]}
              max={rawRange(p)[1]}
              value={mod.values[p.pos]}
              style="--fill: {rawFraction(p, mod.values[p.pos]) * 100}%"
              oninput={(e) => setValue(p, Number(e.currentTarget.value))}
            />
          {/if}
          <div class="stepper">
            <button aria-label="Decrease {p.name}" onclick={() => setValue(p, mod.values[p.pos] - 1)}>◀</button>
            <output>{formatValue(p, mod.values[p.pos])}</output>
            <button aria-label="Increase {p.name}" onclick={() => setValue(p, mod.values[p.pos] + 1)}>▶</button>
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .panel {
    display: grid;
    grid-template-columns: minmax(220px, 300px) 1fr;
    gap: 28px;
    background: var(--panel);
    border-radius: 6px;
    padding: 24px 28px;
    min-height: 0;
    height: 100%;
  }
  .models {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .models-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 6px 12px 22px;
  }
  h2 {
    font-size: 1.35rem;
    font-weight: 500;
    margin: 0;
  }
  ol {
    list-style: none;
    margin: 0;
    padding: 12px;
    background: var(--well);
    overflow-y: auto;
    flex: 1;
    min-height: 200px;
  }
  li button {
    display: block;
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    color: var(--text);
    padding: 6px 10px;
    font-size: 1.05rem;
    border-radius: 0;
  }
  li button:hover {
    background: var(--hover);
  }
  li[aria-selected='true'] button {
    background: var(--accent);
    color: var(--on-accent);
  }
  .params {
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  h3 {
    text-align: center;
    font-size: 1.35rem;
    font-weight: 500;
    margin: 0 0 6px;
  }
  .sliders {
    display: flex;
    flex-direction: column;
    gap: 22px;
    max-width: 680px;
    width: 100%;
    margin: 0 auto;
  }
  .param {
    display: grid;
    grid-template-columns: 7.5rem 1fr 9.5rem;
    align-items: center;
    gap: 16px;
  }
  .param label {
    font-size: 1.05rem;
    letter-spacing: 0.02em;
  }
  .param select {
    background: var(--well);
    color: var(--text);
    border: 1px solid var(--line);
    padding: 6px 8px;
    border-radius: 4px;
    font: inherit;
  }
  .stepper {
    display: grid;
    grid-template-columns: 1.6rem 1fr 1.6rem;
    align-items: center;
  }
  .stepper button {
    background: none;
    border: none;
    color: var(--text);
    font-size: 0.9rem;
    padding: 4px 0;
  }
  .stepper button:hover {
    color: var(--accent);
  }
  output {
    text-align: center;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  input[type='range'] {
    appearance: none;
    width: 100%;
    height: 6px;
    border-radius: 3px;
    background: linear-gradient(to right, var(--accent) var(--fill), var(--line) var(--fill));
    cursor: pointer;
  }
  input[type='range']::-webkit-slider-thumb {
    appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #1d1e20;
    border: 3px solid var(--accent);
    box-shadow: 0 1px 4px rgb(0 0 0 / 0.5);
  }
  input[type='range']::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #1d1e20;
    border: 3px solid var(--accent);
  }
  @media (max-width: 900px) {
    .panel {
      grid-template-columns: 1fr;
    }
    ol {
      max-height: 240px;
    }
    .param {
      grid-template-columns: 6rem 1fr 8rem;
      gap: 10px;
    }
  }
</style>

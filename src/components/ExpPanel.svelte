<script lang="ts">
  import { editor } from '../lib/store.svelte';
  import { catalog, expTarget, formatValue, rawFraction } from '../lib/catalog';
  import { EXP_MODULES, EXP_PARAMS, EXP_VOL_MAX } from '../lib/protocol/exp';
  import Dialog from './Dialog.svelte';
  import ExpPedal from './ExpPedal.svelte';
  import SliderRow from './SliderRow.svelte';
  import Toggle from './Toggle.svelte';

  let { onclose }: { onclose: () => void } = $props();

  const exp = $derived(editor.live?.exp);

  /** The controlled parameter in the current model and its live value (moves with the pedal). */
  const target = $derived.by(() => {
    const live = editor.live;
    const t = exp && live && expTarget(exp, live.modules);
    if (!t || !live) return null;
    const mod = live.modules[t.slot];
    return { name: t.name, slotName: catalog.slots[t.slot].name, model: t.model.name, spec: t.spec, raw: t.spec ? mod.values[t.spec.pos] : 0, on: mod.on };
  });

  function pickModule(m: number) {
    if (!exp || m === exp.MODULE_CTRL) return;
    // The editor selects the module's first parameter when switching modules (session 5).
    editor.editExp({ MODULE_CTRL: m, PARA_CTRL: EXP_PARAMS[m][0].id });
  }
</script>

<Dialog title="EXP" wide {onclose} footer="The settings below are part of the preset: they apply right away; save the preset to keep them. The mode now (toe switch) and the pedal's position are playing, not changes. CALIBRATE is only available on the pedal.">
  {#if !exp}
    <p class="muted">Select a preset first.</p>
  {:else}
  {@const modeNow = editor.expMode ?? exp.FUN_SWITCH}
  <div class="layout">
    <ExpPedal />
    <div class="settings">
    <div class="now">
      <span class="muted">Mode now</span>
      <div class="seg" role="radiogroup" aria-label="Mode now (toe switch)">
        <button class="btn" role="radio" aria-checked={modeNow === 1} class:selected={modeNow === 1} disabled={!editor.online} onclick={() => modeNow !== 1 && editor.toe()}>EXP</button>
        <button class="btn" role="radio" aria-checked={modeNow !== 1} class:selected={modeNow !== 1} disabled={!editor.online} onclick={() => modeNow === 1 && editor.toe()}>VOLUME</button>
      </div>
      <span class="muted">Same as a firm toe press on the pedal; the EXP LED is lit in EXP mode.</span>
    </div>

    <section class:active={modeNow === 1}>
      <div class="inline">
        <h3>EXP mode</h3>
        {#if modeNow === 1}<span class="tag">active now</span>{/if}
      </div>
      <p class="muted">The pedal moves one parameter of the preset.</p>
      <div class="inline">
        <Toggle checked={exp.FUN_SWITCH === 1} label="Start in EXP mode" onchange={(on) => editor.editExp({ FUN_SWITCH: on ? 1 : 0 })} />
        <span>Start in EXP mode <span class="muted">(otherwise the preset starts in volume mode)</span></span>
      </div>
      <div class="pick">
        {#if target}
          <div class="live" aria-live="polite">
            {#if target.spec}
              <span>Pedal moves <strong>{target.slotName} → {target.name}</strong> <span class="muted">({target.model})</span></span>
              <div class="meter" style="--fill: {rawFraction(target.spec, target.raw) * 100}%"></div>
              <output>{formatValue(target.spec, target.raw)}</output>
            {:else}
              <span class="warn">The current {target.slotName} model ({target.model}) has no {target.name}; the pedal has no effect.</span>
            {/if}
          </div>
          {#if target.spec && !target.on}
            <p class="warn">{target.slotName} is switched off in this preset: the pedal moves {target.name}, but you hear no change.</p>
          {/if}
        {/if}
        <div class="modules" role="radiogroup" aria-label="Module">
          {#each EXP_MODULES as name, m (name)}
            <button class="btn" role="radio" aria-checked={exp.MODULE_CTRL === m} class:selected={exp.MODULE_CTRL === m} onclick={() => pickModule(m)}>{name}</button>
          {/each}
        </div>
        <div class="params" role="radiogroup" aria-label="Parameter">
          {#each EXP_PARAMS[exp.MODULE_CTRL] ?? [] as p (p.id)}
            <button class="btn" role="radio" aria-checked={exp.PARA_CTRL === p.id} class:selected={exp.PARA_CTRL === p.id} onclick={() => editor.editExp({ PARA_CTRL: p.id })}>{p.name}</button>
          {/each}
        </div>
      </div>
    </section>

    <section class:active={modeNow !== 1}>
      <div class="inline">
        <h3>Volume mode</h3>
        {#if modeNow !== 1}<span class="tag">active now</span>{/if}
      </div>
      <p class="muted">The pedal sets the overall volume between MIN and MAX. Its position is not reported over USB.</p>
      <div class="inline">
        <Toggle checked={exp.VOL_SWITCH === 1} label="Volume mode on" onchange={(on) => editor.editExp({ VOL_SWITCH: on ? 1 : 0 })} />
        <span>Volume mode on {#if exp.VOL_SWITCH !== 1}<span class="muted">(off: in volume mode the pedal does nothing)</span>{/if}</span>
      </div>
      <div class="rows" class:dim={exp.VOL_SWITCH !== 1}>
        <SliderRow id="exp-min" label="MIN" value={exp.VOL_MIN} max={EXP_VOL_MAX} onchange={(v) => editor.editExp({ VOL_MIN: v })} />
        <SliderRow id="exp-max" label="MAX" value={exp.VOL_MAX} max={EXP_VOL_MAX} onchange={(v) => editor.editExp({ VOL_MAX: v })} />
      </div>
    </section>
    </div>
  </div>
  {/if}
</Dialog>

<style>
  .layout {
    display: flex;
    gap: 28px;
    align-items: flex-start;
  }
  .settings {
    flex: 1;
    min-width: 0;
  }
  .pick {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 12px;
  }
  .dim {
    opacity: 0.6;
  }
  .now {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
  }
  .seg {
    display: inline-flex;
    gap: 4px;
  }
  /* More specific than the dialog's shared section style (which has no side padding). */
  .settings section {
    padding: 14px 18px;
    border: 1px solid var(--line);
    border-radius: 6px;
    margin-bottom: 12px;
    opacity: 0.6;
  }
  .settings section.active {
    opacity: 1;
    border-color: var(--accent);
  }
  .settings section p {
    margin: 4px 0 10px;
  }
  .tag {
    color: var(--accent);
    font-size: 0.85rem;
    font-weight: 600;
  }
  .live {
    display: grid;
    grid-template-columns: 1fr minmax(120px, 2fr) 6rem;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    background: var(--well);
    border-radius: 4px;
  }
  .meter {
    height: 8px;
    border-radius: 4px;
    background: linear-gradient(to right, var(--accent) var(--fill), var(--line) var(--fill));
  }
  .live output {
    text-align: right;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .warn {
    color: var(--warn);
  }
  .modules,
  .params {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .modules :global(.btn) {
    min-width: 4.2rem;
  }
  .params :global(.btn) {
    padding: 6px 12px;
    font-size: 0.9rem;
  }
</style>

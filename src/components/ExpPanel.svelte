<script lang="ts">
  import { editor } from '../lib/store.svelte';
  import { catalog, expTarget, formatValue, rawFraction } from '../lib/catalog';
  import { EXP_MODULES, EXP_PARAMS, EXP_VOL_MAX } from '../lib/protocol/exp';
  import Dialog from './Dialog.svelte';
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

<Dialog title="EXP" {onclose} footer="Changes apply to the current preset right away; save the preset to keep them. The toe switch and the pedal's position are not changes: saving keeps the preset's own mode and value. CALIBRATE is only available on the pedal.">
  {#if !exp}
    <p class="muted">Select a preset first.</p>
  {:else}
    <section>
      <div class="inline">
        <h3>FUNCTION</h3>
        <Toggle checked={exp.FUN_SWITCH === 1} label="EXP function" onchange={(on) => editor.editExp({ FUN_SWITCH: on ? 1 : 0 })} />
        {#if editor.expMode !== null && editor.expMode !== exp.FUN_SWITCH}
          <span class="muted" aria-live="polite">The toe switch has the pedal in {editor.expMode === 1 ? 'EXP' : 'volume'} mode now; the preset starts {exp.FUN_SWITCH === 1 ? 'with EXP' : 'in volume mode'}.</span>
        {/if}
      </div>
      <div class="pick" class:dim={exp.FUN_SWITCH !== 1}>
        <div class="modules" role="radiogroup" aria-label="Module">
          {#each EXP_MODULES as name, m (name)}
            <button class="btn" role="radio" aria-checked={exp.MODULE_CTRL === m} class:selected={exp.MODULE_CTRL === m} onclick={() => pickModule(m)}>{name}</button>
          {/each}
        </div>
        {#if target}
          <div class="live" aria-live="polite">
            {#if target.spec}
              <span class="muted">{target.slotName} · {target.model} · {target.name}</span>
              <div class="meter" style="--fill: {rawFraction(target.spec, target.raw) * 100}%"></div>
              <output>{formatValue(target.spec, target.raw)}</output>
              {#if !target.on}<span class="warn">module is off</span>{/if}
            {:else}
              <span class="warn">The current {target.slotName} model ({target.model}) has no {target.name}; the pedal has no effect.</span>
            {/if}
          </div>
        {/if}
        <div class="params" role="radiogroup" aria-label="Parameter">
          {#each EXP_PARAMS[exp.MODULE_CTRL] ?? [] as p (p.id)}
            <button class="btn" role="radio" aria-checked={exp.PARA_CTRL === p.id} class:selected={exp.PARA_CTRL === p.id} onclick={() => editor.editExp({ PARA_CTRL: p.id })}>{p.name}</button>
          {/each}
        </div>
      </div>
    </section>

    <section>
      <div class="inline">
        <h3>EXP VOL</h3>
        <Toggle checked={exp.VOL_SWITCH === 1} label="EXP volume" onchange={(on) => editor.editExp({ VOL_SWITCH: on ? 1 : 0 })} />
      </div>
      <div class="rows" class:dim={exp.VOL_SWITCH !== 1}>
        <SliderRow id="exp-min" label="MIN" value={exp.VOL_MIN} max={EXP_VOL_MAX} onchange={(v) => editor.editExp({ VOL_MIN: v })} />
        <SliderRow id="exp-max" label="MAX" value={exp.VOL_MAX} max={EXP_VOL_MAX} onchange={(v) => editor.editExp({ VOL_MAX: v })} />
      </div>
    </section>
  {/if}
</Dialog>

<style>
  .pick {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 12px;
  }
  .dim {
    opacity: 0.6;
  }
  .live {
    display: grid;
    grid-template-columns: 1fr minmax(120px, 2fr) 6rem auto;
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

<script lang="ts">
  import { editor } from '../lib/store.svelte';
  import { downloadText } from '../lib/files';
  import { BRIGHTNESS_MAX, GLOBAL_EQ_PARAMS, LEVEL_LABELS, eqRawMax, formatEq } from '../lib/protocol/system';
  import Dialog from './Dialog.svelte';
  import SliderRow from './SliderRow.svelte';
  import Toggle from './Toggle.svelte';

  let { onclose }: { onclose: () => void } = $props();

  const sys = $derived(editor.system);
  const eq = $derived(editor.globalEq);

  function setEq(i: number, raw: number) {
    if (!eq) return;
    const values = [...eq.values];
    values[i] = raw;
    editor.updateGlobalEq({ ...eq, values });
  }

  function exportBackup() {
    const out = editor.exportBackup();
    if (out) downloadText(out.filename, out.json);
  }

  const levels = [
    { key: 'inputLevel', label: 'INPUT LEVEL' },
    { key: 'otgLevel', label: 'OTG LEVEL' },
  ] as const;
  const levelLabel = (v: number) => LEVEL_LABELS[v] ?? String(v);
</script>

<Dialog title="SYSTEM" {onclose} footer="Settings take effect on the pedal immediately. Factory RESET is intentionally not offered here.">
  {#if !sys}
    <p class="muted">Connect the device to load its system settings.</p>
  {:else}
    <section class="rows">
      {#each levels as l (l.key)}
        <SliderRow id={l.key} label={l.label} value={sys[l.key]} max={LEVEL_LABELS.length - 1} format={levelLabel}
          onchange={(v) => editor.updateSystem({ [l.key]: v })} />
      {/each}
      <SliderRow id="brightness" label="BRIGHTNESS" value={sys.brightness} max={BRIGHTNESS_MAX}
        onchange={(v) => editor.updateSystem({ brightness: v })} />
    </section>

    <section class="inline">
      <h3>CAB SIM THRU</h3>
      <span>LEFT OUT CAB</span>
      <Toggle checked={sys.cabLeft} label="Left out cab" onchange={(v) => editor.updateSystem({ cabLeft: v })} />
      <span>RIGHT OUT CAB</span>
      <Toggle checked={sys.cabRight} label="Right out cab" onchange={(v) => editor.updateSystem({ cabRight: v })} />
    </section>

    {#if eq}
      <section>
        <div class="inline">
          <h3>GLOBAL EQ</h3>
          <Toggle checked={eq.on} label="Global EQ" onchange={(on) => editor.updateGlobalEq({ ...eq, on })} />
        </div>
        <div class="rows" class:dim={!eq.on}>
          {#each GLOBAL_EQ_PARAMS as p, i (p.name)}
            <SliderRow id="eq-{i}" label={p.name} value={eq.values[i]} max={eqRawMax(p)} format={(v) => formatEq(p, v)}
              onchange={(v) => setEq(i, v)} />
          {/each}
        </div>
      </section>
    {/if}

    {#if editor.spillOver !== null}
      <section class="inline">
        <h3>SPILL-OVER</h3>
        <Toggle checked={editor.spillOver} label="Spill-over" onchange={(on) => editor.setSpillOver(on)} />
      </section>
    {/if}

    <section class="inline">
      <h3>BACKUP</h3>
      <button class="btn" onclick={exportBackup} disabled={editor.loaded === 0}>BACKUP</button>
      <span class="muted">Saves all presets and system settings as JSON. Restore is not implemented yet.</span>
    </section>

    <section class="inline">
      <h3>LANGUAGE</h3>
      <span class="muted">Pedal display</span>
      <button class="btn" class:selected={sys.language === 0} onclick={() => editor.updateSystem({ language: 0 })}>中文</button>
      <button class="btn" class:selected={sys.language === 1} onclick={() => editor.updateSystem({ language: 1 })}>ENGLISH</button>
    </section>
  {/if}
</Dialog>

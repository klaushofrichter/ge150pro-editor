<script lang="ts">
  import { onMount } from 'svelte';
  import ModuleIcon from './components/ModuleIcon.svelte';
  import ModulePanel from './components/ModulePanel.svelte';
  import SystemPanel from './components/SystemPanel.svelte';
  import ExpPanel from './components/ExpPanel.svelte';
  import ArrangeDialog from './components/ArrangeDialog.svelte';
  import WelcomeDialog, { termsAccepted } from './components/WelcomeDialog.svelte';
  import DesktopOnly, { isPhone } from './components/DesktopOnly.svelte';
  import Toggle from './components/Toggle.svelte';
  import { catalog } from './lib/catalog';
  import { GE150Pro } from './lib/device';
  import { paddedLabel, PRESET_COUNT, presetLabel } from './lib/protocol/preset';
  import { RHYTHM_MODES, styleName } from './lib/protocol/rhythm';
  import { expLabel } from './lib/protocol/exp';
  import { editor } from './lib/store.svelte';
  import { askPresetName, downloadText, folderSupported as canOpenFolders } from './lib/files';

  const supported = GE150Pro.supported();
  const folderSupported = canOpenFolders();
  let showSettings = $state(false);
  let showSystem = $state(false);
  let showExp = $state(false);
  let showArrange = $state(false);
  /** The first-visit panel: what this is, the factory presets, the risk. */
  let showWelcome = $state(!termsAccepted());
  /** Opened from the About button after the terms were accepted: a plain dialog. */
  let welcomeAccepted = $state(false);
  function showAbout() {
    welcomeAccepted = termsAccepted();
    showWelcome = true;
  }
  let notice = $state('');
  /** On a phone, a notice instead of the editor, until "Show it anyway". */
  let phone = $state(isPhone());
  const label = paddedLabel;

  onMount(() => {
    if (phone) return;
    start();
  });

  function start() {
    editor.loadOriginal();
    if (new URLSearchParams(location.search).has('demo')) editor.loadDemo();
    else if (supported) editor.connect(true);
  }

  function showAnyway() {
    phone = false;
    start();
  }

  let presetList: HTMLOListElement | undefined = $state();
  $effect(() => {
    void editor.current;
    presetList?.querySelector('.active')?.scrollIntoView({ block: 'nearest' });
  });

  async function store() {
    if (!editor.live) return;
    const name = askPresetName(`Store to ${presetLabel(editor.live.index)} on the device. Preset name`, editor.live.name);
    if (name) await editor.store(name);
  }

  async function rename() {
    if (!editor.live) return;
    const name = askPresetName('Rename preset', editor.live.name);
    if (name && name !== editor.live.name) await editor.rename(name);
  }

  function exportMo() {
    const out = editor.exportMo();
    if (out) downloadText(out.filename, out.json);
  }

  async function importFile(e: Event & { currentTarget: HTMLInputElement }) {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;
    try {
      editor.importMo(await file.text());
    } catch (err) {
      notice = err instanceof Error ? err.message : String(err);
    }
  }

  async function loadLocal(name: string) {
    notice = '';
    try {
      await editor.loadLocal(name);
    } catch (err) {
      notice = `${name}: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

</script>

{#if phone}
  <DesktopOnly oncontinue={showAnyway} />
{:else}
<div class="app">
  <header class="top">
    <div class="box preset-nav">
      <button class="arrow" aria-label="Previous preset" disabled={!editor.device && !editor.demo} onclick={() => editor.step(-1)}>◀</button>
      <button class="pname" title="Rename" disabled={!editor.live} onclick={rename}>{editor.live?.name ?? 'GE150 PRO'}{editor.dirty ? ' *' : ''}</button>
      <button class="arrow" aria-label="Next preset" disabled={!editor.device && !editor.demo} onclick={() => editor.step(1)}>▶</button>
    </div>
    <button class="box icon" title="Store preset to device" aria-label="Store preset" disabled={!editor.live} onclick={store}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4h13l3 3v13H4z" /><path d="M8 4v5h8V4M7 20v-6h10v6" /></svg>
    </button>

    <div
      class="box rhythm"
      class:off={!editor.rhythm}
      class:playing={editor.rhythm?.playing}
      title={editor.rhythm
        ? `Drum machine ${editor.rhythm.playing ? 'playing' : 'stopped'}: ${RHYTHM_MODES[editor.rhythm.mode] ?? 'mode ' + editor.rhythm.mode}, ${styleName(editor.rhythm)}. Change it with the RHYTHM button and menu on the pedal; the official editor cannot set it either.`
        : 'Drum machine information appears here once the pedal is connected.'}
    >
      <span class="rlabel">{editor.rhythm ? styleName(editor.rhythm) : 'RHYTHM'}</span>
      <dl><dt>BPM</dt><dd>{editor.rhythm?.bpm ?? '–'}</dd><dt>VOL</dt><dd>{editor.rhythm?.volume ?? '–'}</dd></dl>
    </div>
    <div class="cabs" class:off={!editor.system} title="Cab simulation on the left/right outputs (system setting)">
      <span>CAB-L</span><Toggle checked={editor.system?.cabLeft ?? false} disabled={!editor.system} label="CAB-L" onchange={(v) => editor.updateSystem({ cabLeft: v })} />
      <span>CAB-R</span><Toggle checked={editor.system?.cabRight ?? false} disabled={!editor.system} label="CAB-R" onchange={(v) => editor.updateSystem({ cabRight: v })} />
    </div>
    <button class="box exp" title="Expression pedal assignment of this preset" disabled={!editor.live} onclick={() => (showExp = true)}>
      <span>EXP: {editor.live ? (editor.live.exp.FUN_SWITCH === 1 ? expLabel(editor.live.exp) : 'OFF') : '–'}</span>
      <span class="chip">EXP</span>
    </button>

    <span class="grow"></span>
    {#if editor.demo}
      <span class="muted" title="Made-up presets; nothing is sent to a pedal">Demo</span>
      <a class="demo-link" href="./">Leave</a>
    {:else if !supported}
      <span class="warn">WebHID needs Chrome or Edge on a computer</span>
      <a class="demo-link" href="./?demo">Try the demo</a>
    {:else if !editor.device}
      <a class="demo-link" href="./?demo">Try the demo</a>
      <button class="connect" onclick={() => editor.connect()}>Connect device</button>
    {:else if editor.status === 'loading'}
      <span class="muted">Loading {editor.loaded}/{PRESET_COUNT}</span>
    {/if}
    <button class="box icon" aria-label="About, factory presets and terms of use" title="About, factory presets and terms of use" onclick={showAbout}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" /></svg>
    </button>
    <button class="box icon" aria-label="Tools and USB log" title="Tools and USB log" aria-expanded={showSettings} onclick={() => (showSettings = !showSettings)}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
    </button>
    <button class="box icon" aria-label="System settings" title="System settings" onclick={() => (showSystem = true)}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3.2" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" /></svg>
    </button>
  </header>

  {#if showSystem}
    <SystemPanel onclose={() => (showSystem = false)} />
  {/if}
  {#if showExp}
    <ExpPanel onclose={() => (showExp = false)} />
  {/if}
  {#if showWelcome}
    <WelcomeDialog accepted={welcomeAccepted} onconfirm={() => (showWelcome = false)} />
  {/if}
  {#if showArrange}
    <ArrangeDialog onclose={() => (showArrange = false)} />
  {/if}

  {#if showSettings}
    <section class="settings">
      <div class="row">
        <span>Device: {editor.device?.name ?? 'not connected'}</span>
        <span class="muted">Editor {import.meta.env.VITE_APP_VERSION ?? 'development build'} · <a href="https://github.com/klaushofrichter/ge150pro-editor">source</a></span>
        {#if editor.device}<button onclick={() => editor.disconnect()}>Disconnect</button>{/if}
        <button disabled={!editor.dirty} onclick={() => editor.revert()}>Revert unsaved changes</button>
        <button disabled={!editor.live} onclick={exportMo}>Export .mo</button>
        <label class="btn">Import .mo<input type="file" accept=".mo,application/json" hidden onchange={importFile} /></label>
        <button disabled={!editor.device || editor.selfTest?.length === 0} title="Set a few silent values, read them back from the pedal, restore them. Nothing is stored." onclick={() => editor.runSelfTest()}>Device self-test</button>
      </div>
      {#if editor.selfTest}
        <ul class="selftest">
          {#if editor.selfTest.length === 0}<li>Running…</li>{/if}
          {#each editor.selfTest as r (r.name)}
            <li class={r.status}><strong>{r.status.toUpperCase()}</strong> {r.name}: {r.detail}</li>
          {/each}
        </ul>
      {/if}
      <ol class="log">
        {#each editor.log as e, i (i)}
          <li class={e.dir}><code>{e.dir === 'out' ? '→' : '←'} {e.cmd.toString(16).padStart(2, '0')} {e.bytes}</code></li>
        {/each}
      </ol>
    </section>
  {/if}

  {#if editor.error || notice}
    <p class="error" role="alert">{editor.error || notice}</p>
  {/if}

  <div class="body">
    <aside class="side">
      <section class="list presets">
        <h2>
          PRESET
          <span class="tools">
            <button class="icon-sm" aria-label="Arrange and back up presets" title="Arrange and back up presets" disabled={editor.status !== 'ready'} onclick={() => (showArrange = true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><path d="M14 17.5h7M17.5 14v7" /></svg>
            </button>
          </span>
        </h2>
        <ol bind:this={presetList}>
          {#each Array.from({ length: PRESET_COUNT }, (_, k) => k + 1) as i (i)}
            {@const origin = editor.originOf(editor.presets[i - 1])}
            <li>
              <button class:active={i === editor.current} class:unused={origin === 'empty'} disabled={!editor.device && !editor.demo} onclick={() => editor.select(i)}>
                {label(i)}&nbsp; {editor.presets[i - 1]?.name ?? ''}
                {#if origin === 'modified'}<span class="mark modified" title="Modified: the original set has this name with another sound">M</span>{:else if origin === 'new'}<span class="mark new" title="New: not in the original set">N</span>{/if}
              </button>
            </li>
          {/each}
        </ol>
      </section>
      <section class="list computer">
        <h2>
          COMPUTER
          <span class="tools">
            <button class="icon-sm" aria-label="Choose preset folder" title={folderSupported ? 'Choose a folder with .mo files' : 'Folder access needs Chrome or Edge'} disabled={!folderSupported} onclick={() => editor.chooseFolder()}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h7l2 2h9v11H3z" /></svg>
            </button>
            <button class="icon-sm" aria-label="Refresh folder" onclick={() => editor.refreshFolder()}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5" /></svg>
            </button>
          </span>
        </h2>
        <ol>
          {#each editor.localFiles as f (f.name)}
            <li>
              <button class:active={f.name === editor.localSelected} disabled={!editor.live} title="Load into the current preset (not stored until you save)" onclick={() => loadLocal(f.name)}>{f.name}</button>
            </li>
          {:else}
            <li class="hint">Click the folder icon to list .mo presets from your computer.</li>
          {/each}
        </ol>
      </section>
    </aside>

    <main class="main">
      <p class="banner">
        {#if editor.dirty}Changes are live on the device. Use the save button to store them.{:else if editor.live}{presetLabel(editor.live.index)} · {editor.live.name}{:else}Connect the GE150 Pro over USB and select a preset.{/if}
      </p>

      <nav class="chain" aria-label="Signal chain">
        {#each catalog.slots as s, slot (slot)}
          {@const on = editor.live?.modules[slot]?.on ?? false}
          <button class="mod" class:on class:selected={editor.selectedSlot === slot} aria-pressed={editor.selectedSlot === slot} onclick={() => (editor.selectedSlot = slot)}>
            <span>{s.name.replace('/', ' / ')}</span>
            <ModuleIcon {slot} />
          </button>
        {/each}
      </nav>

      <div class="panel-wrap">
        {#if editor.live}
          <ModulePanel
            slot={editor.selectedSlot}
            mod={editor.live.modules[editor.selectedSlot]}
            onchange={(m) => editor.editModule(editor.selectedSlot, m)}
          />
        {:else}
          <div class="empty">{editor.device ? 'Select a preset.' : 'Quit the official GE150PRO app, then click Connect device.'}</div>
        {/if}
      </div>
    </main>
  </div>
</div>
{/if}

<style>
  .app {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg);
  }
  button {
    font: inherit;
    color: inherit;
    cursor: pointer;
  }
  button:disabled {
    cursor: default;
  }
  .top {
    display: flex;
    align-items: center;
    gap: 18px;
    padding: 14px 24px;
    flex-wrap: wrap;
  }
  .box {
    background: var(--well);
    border-radius: 4px;
    border: none;
    height: 56px;
    display: flex;
    align-items: center;
  }
  .preset-nav {
    width: min(460px, 100%);
    justify-content: space-between;
    padding: 0 12px;
  }
  .preset-nav .pname {
    background: none;
    border: none;
    font-size: 1.7rem;
    font-weight: 600;
    flex: 1;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .arrow {
    background: none;
    border: none;
    font-size: 1.2rem;
    padding: 8px;
  }
  .icon {
    width: 56px;
    justify-content: center;
    color: var(--text);
  }
  .icon svg {
    width: 30px;
    height: 30px;
  }
  .rhythm {
    gap: 28px;
    padding: 0 20px;
    font-size: 1.15rem;
  }
  .rhythm.off {
    opacity: 0.55;
  }
  .rhythm.playing .rlabel {
    color: var(--accent);
  }
  .rhythm dl {
    display: grid;
    grid-template-columns: auto 2.5em;
    gap: 0 12px;
    margin: 0;
    font-size: 0.85rem;
  }
  .rhythm dd {
    margin: 0;
    text-align: right;
  }
  .selftest {
    list-style: none;
    margin: 8px 0;
    padding: 0;
    font-size: 0.85rem;
  }
  .selftest .pass strong {
    color: var(--accent);
  }
  .selftest .fail strong {
    color: var(--danger);
  }
  .selftest .skip strong {
    color: var(--muted);
  }
  .cabs {
    display: grid;
    grid-template-columns: auto auto;
    gap: 4px 14px;
    align-items: center;
    font-size: 0.85rem;
  }
  .cabs.off {
    opacity: 0.55;
  }
  .exp {
    gap: 18px;
    padding: 0 10px 0 20px;
    font: inherit;
    font-size: 1.05rem;
    color: var(--text);
    cursor: pointer;
  }
  .exp:hover:not(:disabled) .chip {
    color: var(--accent);
  }
  .chip {
    background: var(--panel);
    padding: 6px 12px;
    border-radius: 3px;
  }
  .grow {
    flex: 1;
  }
  .connect {
    background: var(--accent);
    color: var(--on-accent);
    border: none;
    border-radius: 4px;
    padding: 10px 18px;
    font-weight: 600;
  }
  .warn {
    color: var(--warn);
  }
  .muted {
    color: var(--muted);
  }
  .error {
    color: var(--danger);
    margin: 0 24px 8px;
  }
  .settings {
    margin: 0 24px 12px;
    background: var(--panel);
    border-radius: 6px;
    padding: 12px 16px;
  }
  .settings .row {
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
  }
  .settings button,
  .btn {
    background: var(--well);
    border: 1px solid var(--line);
    border-radius: 4px;
    padding: 6px 12px;
    cursor: pointer;
  }
  .log {
    list-style: none;
    margin: 10px 0 0;
    padding: 0;
    max-height: 160px;
    overflow-y: auto;
    font-size: 0.75rem;
  }
  .log .out {
    color: var(--accent);
  }
  .body {
    display: grid;
    grid-template-columns: minmax(240px, 460px) 1fr;
    gap: 24px;
    padding: 0 24px 24px;
    flex: 1;
    min-height: 0;
  }
  .side {
    display: grid;
    grid-template-rows: 3fr 2fr;
    gap: 16px;
    min-height: 0;
  }
  .list {
    background: var(--well);
    display: flex;
    flex-direction: column;
    min-height: 0;
    border-radius: 4px;
  }
  .list h2 {
    margin: 0;
    background: var(--panel);
    font-size: 1.3rem;
    font-weight: 500;
    padding: 8px 26px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .tools {
    display: flex;
    gap: 14px;
  }
  .icon-sm {
    background: none;
    border: none;
    padding: 0;
    color: var(--text);
  }
  .icon-sm svg {
    width: 26px;
    height: 26px;
  }
  .list ol {
    list-style: none;
    margin: 0;
    padding: 6px;
    overflow-y: auto;
    flex: 1;
  }
  .list li button {
    display: block;
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    padding: 6px 8px;
    font-size: 1.1rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .list li button:hover:not(:disabled) {
    background: var(--hover);
  }
  .list li button.active {
    background: var(--accent);
    color: var(--on-accent);
  }
  .hint {
    color: var(--muted);
    padding: 10px;
  }
  .main {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }
  .banner {
    text-align: center;
    font-size: 1.1rem;
    margin: 4px 0 18px;
    color: var(--text);
    min-height: 1.4em;
  }
  .chain {
    display: flex;
    gap: 14px;
    justify-content: center;
    position: relative;
    padding: 4px 0 28px;
    overflow-x: auto;
  }
  .chain::before {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    top: 58px;
    border-top: 2px solid var(--line);
    z-index: 0;
  }
  .mod {
    position: relative;
    z-index: 1;
    flex: none;
    width: 120px;
    height: 140px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-evenly;
    background: var(--tab);
    border: 3px solid transparent;
    border-radius: 8px;
    color: var(--muted);
    font-weight: 600;
    font-size: 1.05rem;
    box-shadow: 0 2px 6px rgb(0 0 0 / 0.35);
  }
  .mod.on {
    color: var(--accent);
  }
  .mod.selected {
    border-color: var(--accent);
  }
  .panel-wrap {
    flex: 1;
    min-height: 0;
  }
  .empty {
    background: var(--panel);
    border-radius: 6px;
    height: 100%;
    display: grid;
    place-items: center;
    color: var(--muted);
    font-size: 1.1rem;
    min-height: 240px;
  }
  @media (max-width: 1100px) {
    .body {
      grid-template-columns: 1fr;
    }
    .side {
      grid-template-rows: 300px 180px;
    }
    .chain {
      justify-content: flex-start;
    }
    .mod {
      width: 96px;
      height: 116px;
      font-size: 0.9rem;
    }
    .chain::before {
      top: 48px;
    }
  }
  .presets .mark {
    float: right;
    margin-right: 4px;
  }
  .unused {
    opacity: 0.5;
    font-style: italic;
  }
  .demo-link {
    color: var(--accent);
  }
</style>

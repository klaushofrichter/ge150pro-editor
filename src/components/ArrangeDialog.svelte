<script lang="ts">
  // Arrange the 200 presets into slots and banks by drag and drop, keep backups, and write the result to the pedal.
  import { onMount } from 'svelte';
  import { editor } from '../lib/store.svelte';
  import {
    atSlot, backupFileName, BANK_COUNT, BANK_SIZE, changedSlots, copyAs, copyName, emptyPreset, fileToLayout, isComplete, layoutToFile, MANIFEST_FILE,
    moSet, parseManifest, placeByManifest, placeByName, placeFromTray, presetName, swapBanks, swapSlots, type Layout, type TrayItem,
  } from '../lib/arrange';
  import { askPresetName, dirFiles, downloadText, errorText, folderSupported, pickDirectory } from '../lib/files';
  import { factoryFromFile } from '../lib/firmware';
  import { deleteBackup, listBackups, ORIGINAL_ID, saveBackup, type Backup } from '../lib/backups';
  import { moToPreset, type MoFile } from '../lib/protocol/mo';
  import { presetLabel, type Preset } from '../lib/protocol/preset';

  let { onclose }: { onclose: () => void } = $props();

  // plain values, replaced on every change (never changed in place): see samePreset's cache in arrange.ts
  let layout: Layout = $state.raw(editor.pedalLayout());
  let history: Layout[] = $state.raw([]);
  /** Presets waiting for a slot (from .mo files no slot took, or pushed out by a tray drop). */
  let tray: TrayItem[] = $state([]);
  let showing = $state('the pedal');
  let backups: Backup[] = $state([]);
  let message = $state('');
  let confirming = $state(false);
  let dragOver = $state('');
  /** The slot the slot tools act on (0-based). */
  let selected: number | null = $state(null);
  /** Duplicating: the slot whose preset is copied into the next slot clicked. */
  let copyFrom: number | null = $state(null);

  /** The pedal as a layout, taken again only when its presets change (not on every edit here). */
  const pedal = $derived(editor.pedalLayout());
  const changed = $derived(changedSlots(pedal, layout));
  const changedSet = $derived(new Set(changed));
  const original = $derived(backups.find((b) => b.id === ORIGINAL_ID));
  const canWrite = $derived(editor.online && editor.status === 'ready' && changed.length > 0 && !editor.busy);

  onMount(refresh);

  async function refresh() {
    try {
      backups = await listBackups();
    } catch (e) {
      message = `Backups are not available in this browser: ${errorText(e)}`;
    }
  }

  function change(next: Layout) {
    history = [...history, layout];
    layout = next;
  }

  function undo() {
    const prev = history.at(-1);
    if (!prev) return;
    history = history.slice(0, -1);
    layout = prev;
  }

  function show(next: Layout, what: string, unplaced: TrayItem[] = []) {
    change(next);
    tray = unplaced;
    showing = what;
  }

  // ---- drag and drop ---------------------------------------------------------------------------------------------
  const drag = (e: DragEvent, what: string) => {
    // Option (Alt) while dragging a preset: copy it instead of swapping
    const copy = e.altKey && what.startsWith('slot:');
    e.dataTransfer?.setData('text/plain', copy ? what.replace('slot:', 'copy:') : what);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = copy ? 'copy' : 'move';
  };
  /** What a drop carries: "slot:3", "copy:3", "bank:7" or "tray:0". */
  const dropped = (e: DragEvent) => {
    const [kind, n] = (e.dataTransfer?.getData('text/plain') ?? '').split(':');
    return { kind, n: Number(n) };
  };
  const over = (e: DragEvent, key: string) => {
    e.preventDefault();
    dragOver = key;
  };

  /** Put a .mo file's preset into a slot (undoable; written with the other changes). */
  async function replaceWithMo(file: File, slot: number) {
    try {
      const p = moToPreset(JSON.parse(await file.text()) as MoFile, slot + 1);
      setSlot(slot, p, `is now "${presetName(p)}" from ${file.name}`);
    } catch (err) {
      message = `${file.name}: ${errorText(err)}`;
    }
  }

  function setSlot(slot: number, p: Preset, note: string) {
    const next = [...layout];
    next[slot] = p;
    change(next);
    selected = slot;
    message = `${presetLabel(slot + 1)} ${note} (not written yet).`;
  }

  function makeEmpty(slot: number) {
    const p = layout[slot];
    setSlot(slot, emptyPreset(slot + 1), `is empty now${p ? `; "${presetName(p)}" can come back with Undo` : ''}`);
  }

  /** Copy a preset into a slot under a new name (a copy is a new preset). */
  function duplicate(from: number, to: number) {
    copyFrom = null;
    const p = layout[from];
    if (!p || from === to) return;
    const name = askPresetName(`Name of the copy of "${presetName(p)}" in ${presetLabel(to + 1)}`, copyName(p, layout));
    if (!name) return;
    setSlot(to, copyAs(p, name, to + 1), `is a copy of ${presetLabel(from + 1)}, named "${name}"`);
  }

  function rename(slot: number) {
    const p = layout[slot];
    if (!p) return;
    const name = askPresetName(`New name for ${presetLabel(slot + 1)}`, presetName(p));
    if (!name || name === presetName(p)) return;
    setSlot(slot, { ...atSlot(p, slot + 1), name }, `is renamed "${name}"`);
  }

  function clickSlot(slot: number) {
    if (copyFrom !== null) duplicate(copyFrom, slot);
    else selected = selected === slot ? null : slot;
  }

  function pickMo(e: Event & { currentTarget: HTMLInputElement }) {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (file && selected !== null) replaceWithMo(file, selected);
  }

  function dropOnSlot(e: DragEvent, slot: number) {
    e.preventDefault();
    dragOver = '';
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      if (file.name.toLowerCase().endsWith('.mo')) replaceWithMo(file, slot);
      else message = `${file.name} is not a .mo preset file.`;
      return;
    }
    const { kind, n } = dropped(e);
    if (kind === 'slot' && n !== slot) change(swapSlots(layout, n, slot));
    else if (kind === 'copy') duplicate(n, slot);
    else if (kind === 'tray' && tray[n]) {
      const placed = placeFromTray(layout, tray, n, slot);
      change(placed.layout);
      tray = placed.tray;
    }
  }

  function dropOnBank(e: DragEvent, bank: number) {
    e.preventDefault();
    dragOver = '';
    const { kind, n } = dropped(e);
    if (kind === 'bank' && n !== bank) change(swapBanks(layout, n, bank));
  }

  // ---- backups ---------------------------------------------------------------------------------------------------
  async function backUpPedal() {
    await saveBackup({ name: 'Pedal', source: 'pedal', locked: false, layout: pedal });
    await refresh();
    message = 'Saved a backup of the pedal.';
  }

  async function saveArrangement() {
    if (!isComplete(layout)) return;
    const name = prompt('Name of this backup:', 'My arrangement')?.trim();
    if (!name) return;
    await saveBackup({ name, source: 'file', locked: false, layout: $state.snapshot(layout) as Layout });
    await refresh();
  }

  function download(b: { name: string; created: string; layout: Layout }) {
    downloadText(backupFileName(b.name, b.created), JSON.stringify(layoutToFile(b.layout, b.name, b.created), null, 1));
  }

  /**
   * Every preset of a backup as a .mo file ("01A Name.mo") plus manifest.json describing the set, into a folder;
   * nothing that exists there is replaced.
   */
  async function exportMoFiles(b: Backup) {
    const original = b.source === 'factory';
    const files = await moSet($state.snapshot(b.layout) as Layout, {
      name: b.name,
      kind: original ? 'original' : 'backup',
      immutable: b.locked,
      description: original
        ? 'The factory presets of the GE150 Pro, read from the firmware image. Immutable: keep this set unchanged; restore from it.'
        : `A backup of GE150 Pro presets (${b.source}), saved ${b.created}.`,
      source: original ? { type: 'firmware', from: b.name } : { type: b.source, saved: b.created },
    });
    let dir: FileSystemDirectoryHandle | null;
    try {
      dir = await pickDirectory('ge150-mo-export', 'readwrite');
    } catch (err) {
      message = errorText(err);
      return;
    }
    if (!dir) return;
    const exists = await Promise.all(files.map((f) => dir.getFileHandle(f.filename).then(() => true, () => false)));
    const taken = files.filter((_, k) => exists[k]).map((f) => f.filename);
    if (taken.length) {
      message = `Nothing written: ${dir.name} already has ${taken.length} of these files (${taken.slice(0, 3).join(', ')}…). Choose an empty folder.`;
      return;
    }
    for (const f of files) {
      const w = await (await dir.getFileHandle(f.filename, { create: true })).createWritable();
      await w.write(f.json);
      await w.close();
    }
    message = `Wrote ${files.length} .mo files to ${dir.name}.`;
  }

  /** The factory set becomes the locked original (shown at the top of the backups, used for the M and N marks). */
  async function adoptOriginal(name: string, l: Layout, created?: string) {
    await saveBackup({ id: ORIGINAL_ID, name, created, source: 'factory', locked: true, layout: l });
    await refresh();
    await editor.loadOriginal();
  }

  async function remove(b: Backup) {
    if (!confirm(`Delete the backup "${b.name}"?`)) return;
    await deleteBackup(b.id);
    await refresh();
  }

  async function importFile(e: Event & { currentTarget: HTMLInputElement }) {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;
    try {
      const { layout: l, name, created } = fileToLayout(JSON.parse(await file.text()));
      await saveBackup({ name: name || file.name.replace(/\.json$/i, ''), created: created || undefined, source: 'file', locked: false, layout: l });
      await refresh();
      message = `Imported "${file.name}".`;
    } catch (err) {
      message = `${file.name}: ${errorText(err)}`;
    }
  }

  /** The factory set, from Mooer's download (.zip), its disk image (.dmg) or the firmware (.mr), becomes the locked original. */
  async function importFirmware(e: Event & { currentTarget: HTMLInputElement }) {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;
    message = `Reading ${file.name}…`;
    let got;
    try {
      got = await factoryFromFile(file.name, new Uint8Array(await file.arrayBuffer()));
    } catch (err) {
      got = null;
      console.warn(err);
    }
    if (!got) {
      message = `${file.name}: the factory presets were not found in this file. Use Mooer's GE150 Pro package for Mac (.zip), its .dmg, or the firmware file (.mr).`;
      return;
    }
    await adoptOriginal(`Factory presets (firmware ${got.version})`, got.layout);
    message = `The factory presets (firmware ${got.version}) are now the locked original at the top of the backups. Click Show to see them in the grid.`;
  }

  /**
   * A folder of .mo files: placed by its manifest.json when it has one (checking every file against it), else by
   * slot-named files ("01A …"), else by name (factory order when the original exists, else the pedal's names).
   */
  async function importMoFolder() {
    let dir: FileSystemDirectoryHandle | null;
    try {
      dir = await pickDirectory('ge150-mo-backup');
    } catch (err) {
      message = errorText(err);
      return;
    }
    if (!dir) return;
    const texts = new Map<string, string>();
    for await (const f of dirFiles(dir)) {
      if (f.name.toLowerCase().endsWith('.mo') || f.name === MANIFEST_FILE) texts.set(f.name, await (await f.getFile()).text());
    }
    const manifestText = texts.get(MANIFEST_FILE);
    if (manifestText) {
      try {
        const m = parseManifest(manifestText);
        const { layout: l, changed: ch, missing } = await placeByManifest(m, texts);
        show(l.map((p, i) => p ?? layout[i]), `"${m.name}" (${m.kind}${m.immutable ? ', immutable' : ''}, written ${fmt(m.created)})`);
        const problems = [
          ch.length ? `${ch.length} file(s) changed since the set was written (${ch.slice(0, 3).join(', ')})` : '',
          missing.length ? `${missing.length} file(s) missing (${missing.slice(0, 3).join(', ')})` : '',
        ].filter(Boolean);
        message = problems.length ? `Placed by the manifest, but ${problems.join(' and ')}.` : `All ${m.presets.length} presets placed by the manifest and checked against it.`;
        if (m.kind === 'original' && m.immutable && !original && !problems.length && isComplete(l)) {
          await adoptOriginal(m.name, l, m.created);
          message += ' It is now the locked original.';
        }
      } catch (err) {
        message = `${MANIFEST_FILE}: ${errorText(err)}`;
      }
      return;
    }
    const files: { file: string; mo: MoFile }[] = [];
    for (const [file, text] of texts) {
      try {
        files.push({ file, mo: JSON.parse(text) });
      } catch {
        // not a preset file
      }
    }
    const reference = (original?.layout ?? pedal).map((p) => p?.name);
    const { layout: l, unplaced } = placeByName(files, reference);
    const filled = l.map((p, i) => p ?? layout[i]);
    show(filled, `${dir.name} (${files.length} .mo files, placed by name${original ? ' in factory order' : ''})`, unplaced);
    message = unplaced.length
      ? `${unplaced.length} file(s) matched no slot: drag them from the tray onto a slot. Slots no file matched keep their preset.`
      : `All ${files.length} files placed.`;
  }

  async function write() {
    confirming = false;
    await editor.writeLayout($state.snapshot(layout) as Layout);
    await refresh();
    // after a failed or stopped write the arrangement stays (what is left to write shows as changes, Undo works)
    if (editor.writing?.phase !== 'done') return;
    layout = editor.pedalLayout();
    history = [];
    tray = [];
    showing = 'the pedal';
  }

  const label = (i: number) => presetLabel(i + 1);
  const fmt = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  const estimate = (n: number) => Math.ceil((n * 0.6) / 5) * 5;
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && !editor.busy && !confirming && onclose()} />
<div class="backdrop" role="presentation"></div>
<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="arrange-title">
  <header>
    <h2 id="arrange-title">Arrange and back up presets</h2>
    <button class="close" aria-label="Close" disabled={editor.busy} onclick={onclose}>✕</button>
  </header>

  <div class="layout">
    <section class="arrange">
      <div class="bar">
        <span class="muted">Showing {showing}. Drag a preset onto another to swap them; drag a bank's title to swap whole banks.</span>
        <span class="grow"></span>
        <button class="btn" disabled={!history.length || editor.busy} onclick={undo}>Undo</button>
        <button class="btn" disabled={editor.busy} onclick={() => show(editor.pedalLayout(), 'the pedal')}>Show the pedal</button>
        <button class="btn" disabled={!isComplete(layout) || editor.busy} onclick={saveArrangement}>Save as backup</button>
        <button class="btn primary" disabled={!canWrite} onclick={() => (confirming = true)}>Write {changed.length} change{changed.length === 1 ? '' : 's'} to the pedal…</button>
      </div>

      <div class="bar slot-tools">
        {#if copyFrom !== null}
          <span>Click the slot to copy {presetLabel(copyFrom + 1)} "{presetName(layout[copyFrom]!)}" into.</span>
          <button class="btn sm" onclick={() => (copyFrom = null)}>Cancel</button>
        {:else if selected === null}
          <span class="muted small">Click a slot for: make empty, duplicate, rename, replace with a .mo file. Option-drag a preset to copy it; drop a .mo file from the Finder onto a slot to load it there.</span>
        {:else}
          <strong>{presetLabel(selected + 1)} {layout[selected] ? presetName(layout[selected]!) : '—'}</strong>
          <button class="btn sm" disabled={editor.busy} onclick={() => makeEmpty(selected!)}>Make empty</button>
          <button class="btn sm" disabled={!layout[selected] || editor.busy} onclick={() => (copyFrom = selected)}>Duplicate…</button>
          <button class="btn sm" disabled={!layout[selected] || editor.busy} onclick={() => rename(selected!)}>Rename…</button>
          <label class="btn sm" class:disabled={editor.busy}>
            Replace with a .mo file…
            <input type="file" accept=".mo,application/json" hidden disabled={editor.busy} onchange={pickMo} />
          </label>
        {/if}
      </div>

      {#if editor.original}
        <div class="legend muted small">
          Compared with the original: <span class="mark modified">M</span> modified (same name, other sound)
          <span class="mark new">N</span> new (a name the original set does not have, copies included) · empty slots are dimmed
        </div>
      {/if}

      {#if tray.length}
        <div class="tray" aria-label="Presets without a slot">
          <strong>Without a slot:</strong>
          {#each tray as t, k (k)}
            <span class="chip" draggable="true" role="listitem" ondragstart={(e) => drag(e, `tray:${k}`)} title={t.file}>{t.preset.name}</span>
          {/each}
        </div>
      {/if}

      <div class="banks">
        {#each Array.from({ length: BANK_COUNT }, (_, b) => b) as b (b)}
          <div class="bank" class:target={dragOver === `bank:${b}`}>
            <div
              class="bank-title"
              draggable={!editor.busy}
              role="button"
              tabindex="-1"
              ondragstart={(e) => drag(e, `bank:${b}`)}
              ondragover={(e) => over(e, `bank:${b}`)}
              ondragleave={() => (dragOver = '')}
              ondrop={(e) => dropOnBank(e, b)}
            >
              Bank {b + 1}
            </div>
            {#each Array.from({ length: BANK_SIZE }, (_, k) => b * BANK_SIZE + k) as i (i)}
              {@const p = layout[i]}
              {@const origin = editor.originOf(p)}
              <div
                class="slot"
                class:changed={changedSet.has(i + 1)}
                class:empty={!p}
                class:unused={origin === 'empty'}
                class:copying={copyFrom !== null}
                class:target={dragOver === `slot:${i}`}
                class:selected={selected === i}
                draggable={!!p && !editor.busy}
                role="button"
                tabindex="0"
                aria-pressed={selected === i}
                title={p ? `${label(i)} ${p.name}` : `${label(i)} (no preset)`}
                ondragstart={(e) => drag(e, `slot:${i}`)}
                ondragover={(e) => over(e, `slot:${i}`)}
                ondragleave={() => (dragOver = '')}
                ondrop={(e) => dropOnSlot(e, i)}
                onclick={() => clickSlot(i)}
                onkeydown={(e) => e.key === 'Enter' && clickSlot(i)}
              >
                <span class="letter">{'ABCD'[i % 4]}</span>
                <span class="name">{p?.name ?? '—'}</span>
                {#if origin === 'modified'}<span class="mark modified" title="Modified: the original has this name with another sound">M</span>{:else if origin === 'new'}<span class="mark new" title="New: not in the original set">N</span>{/if}
              </div>
            {/each}
          </div>
        {/each}
      </div>
    </section>

    <aside class="backups">
      <h3>Backups</h3>
      <div class="actions">
        <button class="btn" disabled={editor.status !== 'ready' || editor.busy} onclick={backUpPedal}>Back up the pedal now</button>
        <label class="btn">Import a backup file<input type="file" accept=".json,application/json" hidden onchange={importFile} /></label>
        <button class="btn" disabled={editor.busy || !folderSupported()} onclick={importMoFolder}>Place a folder of .mo files…</button>
        {#if !original}
          <label class="btn">Read the factory presets from Mooer's download (.zip, .dmg or .mr)<input type="file" accept=".zip,.dmg,.mr" hidden onchange={importFirmware} /></label>
        {/if}
      </div>
      <ul>
        {#each backups as b (b.id)}
          <li class:locked={b.locked}>
            <div class="bname">{b.locked ? '🔒 ' : ''}{b.name}</div>
            <div class="muted small">{fmt(b.created)} · {b.source === 'factory' ? 'factory set, cannot be changed' : b.source}</div>
            <div class="row">
              <button class="btn sm" disabled={editor.busy} onclick={() => show($state.snapshot(b.layout) as Layout, `the backup "${b.name}"`)}>Show</button>
              <button class="btn sm" onclick={() => download(b)}>Export</button>
              <button class="btn sm" disabled={!folderSupported()} title="One .mo file per slot, named 01A …, into an empty folder" onclick={() => exportMoFiles(b)}>Export .mo files</button>
              <button class="btn sm" disabled={b.locked || editor.busy} onclick={() => remove(b)}>Delete</button>
            </div>
          </li>
        {:else}
          <li class="muted">No backups yet.</li>
        {/each}
      </ul>
      <p class="muted small">Backups are kept in this browser. Export them to keep a copy elsewhere.</p>
    </aside>
  </div>

  {#if message}<p class="message" role="status">{message}</p>{/if}

  {#if confirming}
    <div class="confirm" role="alertdialog" aria-labelledby="confirm-title">
      <h3 id="confirm-title">Write {changed.length} preset{changed.length === 1 ? '' : 's'} to the pedal?</h3>
      <p>
        This permanently replaces {changed.length === 1 ? 'slot' : 'slots'}
        {changed.slice(0, 12).map((i) => presetLabel(i)).join(', ')}{changed.length > 12 ? ` and ${changed.length - 12} more` : ''}
        on the pedal. It takes about {estimate(changed.length)} seconds. A backup of the pedal as it is now is saved first, and
        every preset is read back afterwards to check it. Unsaved changes on the pedal are lost.
      </p>
      <p class="muted">Keep the pedal connected and this page open until it has finished.</p>
      <div class="row">
        <button class="btn" onclick={() => (confirming = false)}>Cancel</button>
        <button class="btn primary" onclick={write}>Write {changed.length} preset{changed.length === 1 ? '' : 's'}</button>
      </div>
    </div>
  {/if}

  {#if editor.writing}
    {@const w = editor.writing}
    <div class="progress" class:failed={w.phase === 'failed'}>
      <div class="ptext">
        {#if w.phase === 'backup'}Saving a backup of the pedal…
        {:else if w.phase === 'writing'}Writing {w.slot ? presetLabel(w.slot) : ''}: {w.done + 1} of {w.total}
        {:else if w.phase === 'verifying'}Reading every preset back to check…
        {:else if w.phase === 'done'}Done. {w.detail}
        {:else if w.phase === 'cancelled'}Stopped. {w.detail}
        {:else}Failed after {w.done} of {w.total}: {w.detail}{/if}
      </div>
      <div class="pbar" role="progressbar" aria-valuemin="0" aria-valuemax={w.total} aria-valuenow={w.done}>
        <div style:width="{w.total ? (w.done / w.total) * 100 : 0}%"></div>
      </div>
      {#if w.phase === 'writing'}<button class="btn sm" onclick={() => editor.cancelWrite()}>Stop after this preset</button>{/if}
    </div>
  {/if}
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 0.55);
    z-index: 10;
  }
  .sheet {
    position: fixed;
    z-index: 11;
    inset: 16px;
    background: var(--panel);
    border-radius: 8px;
    box-shadow: 0 10px 40px rgb(0 0 0 / 0.6);
    display: flex;
    flex-direction: column;
    padding: 14px 20px;
    gap: 10px;
    overflow: hidden;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }
  h2 {
    margin: 0;
    font-weight: 500;
    font-size: 1.4rem;
  }
  h3 {
    margin: 0 0 8px;
    font-weight: 500;
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
  .layout {
    display: grid;
    grid-template-columns: 1fr 300px;
    gap: 16px;
    min-height: 0;
    flex: 1;
  }
  .arrange {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 0;
  }
  .bar,
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .grow {
    flex: 1;
  }
  .btn {
    background: var(--well);
    color: var(--text);
    border: 1px solid #1a1a1c;
    padding: 6px 14px;
    border-radius: 3px;
    cursor: pointer;
    font: inherit;
    font-size: 0.9rem;
  }
  .btn:disabled {
    opacity: 0.45;
    cursor: default;
  }
  .btn.primary {
    border-color: var(--accent);
    color: var(--accent);
  }
  .btn.sm {
    padding: 3px 10px;
    font-size: 0.8rem;
  }
  .muted {
    color: var(--muted);
  }
  .small {
    font-size: 0.8rem;
  }
  .tray {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    align-items: center;
    padding: 6px 8px;
    border: 1px dashed var(--accent);
    border-radius: 4px;
    font-size: 0.85rem;
  }
  .chip {
    background: var(--well);
    padding: 3px 8px;
    border-radius: 3px;
    cursor: grab;
  }
  .banks {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 8px;
    overflow-y: auto;
    padding-right: 4px;
  }
  .bank {
    background: var(--well);
    border-radius: 4px;
    padding: 4px;
    border: 1px solid transparent;
  }
  .bank.target {
    border-color: var(--accent);
  }
  .bank-title {
    font-size: 0.75rem;
    color: var(--muted);
    padding: 2px 4px 4px;
    cursor: grab;
    user-select: none;
  }
  .slot {
    display: flex;
    gap: 6px;
    font-size: 0.8rem;
    padding: 3px 4px;
    border-radius: 3px;
    border: 1px solid transparent;
    cursor: grab;
    white-space: nowrap;
    overflow: hidden;
  }
  .slot .letter {
    color: var(--muted);
    width: 0.8em;
  }
  .slot .name {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .slot.changed {
    border-color: var(--accent);
    color: var(--accent);
  }
  .slot.empty {
    border-style: dashed;
    border-color: var(--line);
    cursor: default;
  }
  .slot.unused .name {
    opacity: 0.4;
    font-style: italic;
  }
  .slot.copying {
    cursor: copy;
  }
  .slot-tools {
    min-height: 30px;
    font-size: 0.9rem;
  }
  .slot.selected {
    background: var(--panel);
    outline: 1px solid var(--text);
  }
  .slot .mark {
    margin-left: auto;
  }
  .legend {
    display: flex;
    gap: 6px;
    align-items: center;
    flex-wrap: wrap;
  }
  label.btn.disabled {
    opacity: 0.45;
    cursor: default;
  }
  .slot.target {
    background: var(--panel);
    border-color: var(--text);
  }
  .backups {
    overflow-y: auto;
    border-left: 1px solid var(--line);
    padding-left: 14px;
  }
  .actions {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 12px;
  }
  .actions .btn {
    text-align: left;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  li {
    background: var(--well);
    border-radius: 4px;
    padding: 6px 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  li.locked {
    border: 1px solid var(--accent);
  }
  .bname {
    font-size: 0.9rem;
  }
  .message {
    margin: 0;
    font-size: 0.85rem;
  }
  .confirm,
  .progress {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: min(560px, calc(100% - 40px));
    background: var(--panel);
    border: 1px solid var(--accent);
    border-radius: 6px;
    padding: 16px 20px;
    box-shadow: 0 10px 40px rgb(0 0 0 / 0.6);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .confirm p {
    margin: 0;
  }
  .progress {
    top: auto;
    bottom: 16px;
    transform: translateX(-50%);
  }
  .progress.failed {
    border-color: var(--danger);
  }
  .pbar {
    height: 10px;
    background: var(--well);
    border-radius: 5px;
    overflow: hidden;
  }
  .pbar div {
    height: 100%;
    background: var(--accent);
    transition: width 0.2s;
  }
  @media (max-width: 900px) {
    .layout {
      grid-template-columns: 1fr;
    }
    .backups {
      border-left: none;
      padding-left: 0;
    }
  }
</style>

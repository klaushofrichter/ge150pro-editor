///<reference types="svelte" />
;// Arrange the 200 presets into slots and banks by drag and drop, keep backups, and write the result to the pedal.

import { onMount } from 'svelte';
import { editor } from '../lib/store.svelte';
import {
    atSlot, BANK_COUNT, BANK_SIZE, changedSlots, copyAs, copyName, emptyPreset, factoryFromFirmware, presetName, KNOWN_FIRMWARE, MANIFEST_FILE, moSet, parseManifest, placeByManifest, fileToLayout, isComplete, layoutToFile, placeByName,
    swapBanks, swapSlots, type Layout,
  } from '../lib/arrange';
import { deleteBackup, listBackups, ORIGINAL_ID, saveBackup, type Backup } from '../lib/backups';
import { moToPreset, type MoFile } from '../lib/protocol/mo';
import { presetLabel, type Preset } from '../lib/protocol/preset';

;type $$ComponentProps =  { onclose: () => void };function $$render() {

  
  
  
  
  
  
  

  let { onclose }:/*Ωignore_startΩ*/$$ComponentProps/*Ωignore_endΩ*/ = $props();

  let layout: Layout = $state(editor.pedalLayout());
  let history: Layout[] = $state([]);
  /** Presets waiting for a slot (from .mo files no slot took, or pushed out by a tray drop). */
  let tray: { file: string; preset: Preset }[] = $state([]);
  let showing = $state('the pedal');
  let backups: Backup[] = $state([]);
  let message = $state('');
  let confirming = $state(false);
  let dragOver = $state('');
  /** The slot the slot tools act on (0-based). */
  let selected: number | null = $state(null);
  /** Duplicating: the slot whose preset is copied into the next slot clicked. */
  let copyFrom: number | null = $state(null);

  const changed = $derived(changedSlots(editor.pedalLayout(), layout));
  const changedSet = $derived(new Set(changed));
  const busy = $derived(!!editor.writing && ['backup', 'writing', 'verifying'].includes(editor.writing.phase));
  const original = $derived(backups.find((b) => b.id === ORIGINAL_ID));
  const canWrite = $derived((!!editor.device || editor.demo) && editor.status === 'ready' && changed.length > 0 && !busy);

  onMount(refresh);

  async function refresh() {
    try {
      backups = await listBackups();
    } catch (e) {
      message = `Backups are not available in this browser: ${e instanceof Error ? e.message : e}`;
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

  function show(next: Layout, what: string, unplaced: { file: string; preset: Preset }[] = []) {
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
  const over = (e: DragEvent, key: string) => {
    e.preventDefault();
    dragOver = key;
  };

  /** Put a .mo file's preset into a slot (undoable; written with the other changes). */
  async function replaceWithMo(file: File, slot: number) {
    try {
      const p = moToPreset(JSON.parse(await file.text()) as MoFile, slot + 1);
      const next = [...layout];
      next[slot] = p;
      change(next);
      selected = slot;
      message = `${presetLabel(slot + 1)} is now "${p.name.trim()}" from ${file.name} (not written yet).`;
    } catch (err) {
      message = `${file.name}: ${err instanceof Error ? err.message : err}`;
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
    const name = prompt(`Name of the copy of "${presetName(p)}" in ${presetLabel(to + 1)} (max 16):`, copyName(p, layout));
    if (!name?.trim()) return;
    setSlot(to, copyAs(p, name.trim(), to + 1), `is a copy of ${presetLabel(from + 1)}, named "${name.trim().slice(0, 16)}"`);
  }

  function rename(slot: number) {
    const p = layout[slot];
    if (!p) return;
    const name = prompt(`New name for ${presetLabel(slot + 1)} (max 16):`, presetName(p));
    if (!name?.trim() || name.trim() === presetName(p)) return;
    setSlot(slot, { ...atSlot(p, slot + 1), name: name.trim().slice(0, 16) }, `is renamed "${name.trim().slice(0, 16)}"`);
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
    const [kind, v] = (e.dataTransfer?.getData('text/plain') ?? '').split(':');
    const n = Number(v);
    if (kind === 'slot' && n !== slot) change(swapSlots(layout, n, slot));
    else if (kind === 'copy') duplicate(n, slot);
    else if (kind === 'tray') {
      const item = tray[n];
      if (!item) return;
      const next = [...layout];
      const out = next[slot];
      next[slot] = atSlot(item.preset, slot + 1);
      change(next);
      tray = tray.filter((_, k) => k !== n).concat(out ? [{ file: `from ${presetLabel(slot + 1)}`, preset: out }] : []);
    }
  }

  function dropOnBank(e: DragEvent, bank: number) {
    e.preventDefault();
    dragOver = '';
    const [kind, v] = (e.dataTransfer?.getData('text/plain') ?? '').split(':');
    if (kind === 'bank' && Number(v) !== bank) change(swapBanks(layout, Number(v), bank));
  }

  // ---- backups ---------------------------------------------------------------------------------------------------
  async function backUpPedal() {
    await saveBackup({ name: 'Pedal', source: 'pedal', locked: false, layout: editor.pedalLayout() });
    await refresh();
    message = 'Saved a backup of the pedal.';
  }

  async function saveArrangement() {
    if (!isComplete(layout)) return;
    const name = prompt('Name of this backup:', 'My arrangement');
    if (!name) return;
    await saveBackup({ name, source: 'file', locked: false, layout: $state.snapshot(layout) as Layout });
    await refresh();
  }

  function download(b: { name: string; created: string; layout: Layout }) {
    const json = JSON.stringify(layoutToFile(b.layout, b.name, b.created), null, 1);
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const stamp = b.created.slice(0, 16).replace(/[:T]/g, '-');
    Object.assign(document.createElement('a'), { href: url, download: `GE150PRO ${b.name} ${stamp}.json` }).click();
    URL.revokeObjectURL(url);
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
    let dir: FileSystemDirectoryHandle;
    try {
      dir = await (window as unknown as { showDirectoryPicker(o?: object): Promise<FileSystemDirectoryHandle> }).showDirectoryPicker({ id: 'ge150-mo-export', mode: 'readwrite' });
    } catch {
      return; // cancelled
    }
    const exists = async (name: string) => dir.getFileHandle(name).then(() => true, () => false);
    const taken = [];
    for (const f of files) if (await exists(f.filename)) taken.push(f.filename);
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
      message = `${file.name}: ${err instanceof Error ? err.message : err}`;
    }
  }

  /** The factory set from a firmware image becomes the locked original. */
  async function importFirmware(e: Event & { currentTarget: HTMLInputElement }) {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;
    const got = await factoryFromFirmware(new Uint8Array(await file.arrayBuffer()));
    if (!got) {
      message = `${file.name}: not a firmware image this editor knows (${KNOWN_FIRMWARE.map((k) => k.version).join(', ')}).`;
      return;
    }
    await saveBackup({ id: ORIGINAL_ID, name: `Factory presets (firmware ${got.version})`, source: 'factory', locked: true, layout: got.layout });
    await refresh();
    await editor.loadOriginal();
    message = 'The factory presets are now the locked original.';
  }

  /**
   * A folder of .mo files: placed by its manifest.json when it has one (checking every file against it), else by
   * slot-named files ("01A …"), else by name (factory order when the original exists, else the pedal's names).
   */
  async function importMoFolder() {
    let dir: FileSystemDirectoryHandle;
    try {
      dir = await (window as unknown as { showDirectoryPicker(o?: object): Promise<FileSystemDirectoryHandle> }).showDirectoryPicker({ id: 'ge150-mo-backup' });
    } catch {
      return; // cancelled
    }
    const texts = new Map<string, string>();
    for await (const entry of (dir as unknown as { values(): AsyncIterable<FileSystemHandle> }).values()) {
      const lower = entry.name.toLowerCase();
      if (entry.kind === 'file' && (lower.endsWith('.mo') || entry.name === MANIFEST_FILE)) texts.set(entry.name, await (await (entry as FileSystemFileHandle).getFile()).text());
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
          await saveBackup({ id: ORIGINAL_ID, name: m.name, created: m.created, source: 'factory', locked: true, layout: l });
          await refresh();
          await editor.loadOriginal();
          message += ' It is now the locked original.';
        }
      } catch (err) {
        message = `${MANIFEST_FILE}: ${err instanceof Error ? err.message : err}`;
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
    const reference = (original?.layout ?? editor.pedalLayout()).map((p) => p?.name);
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
    layout = editor.pedalLayout();
    history = [];
    tray = [];
    showing = 'the pedal';
    await refresh();
  }

  const label = (i: number) => presetLabel(i + 1);
  const fmt = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  const estimate = (n: number) => Math.ceil((n * 0.6) / 5) * 5;
;
async () => {

 { svelteHTML.createElement("svelte:window", {  "onkeydown":(e) => e.key === 'Escape' && !busy && !confirming && onclose(),});}
 { svelteHTML.createElement("div", {   "class":`backdrop`,"role":`presentation`,}); }
 { svelteHTML.createElement("div", {       "class":`sheet`,"role":`dialog`,"aria-modal":`true`,"aria-labelledby":`arrange-title`,});
   { svelteHTML.createElement("header", {});
     { svelteHTML.createElement("h2", { "id":`arrange-title`,});     }
     { svelteHTML.createElement("button", {       "class":`close`,"aria-label":`Close`,"disabled":busy,"onclick":onclose,});  }
   }

   { svelteHTML.createElement("div", { "class":`layout`,});
     { svelteHTML.createElement("section", { "class":`arrange`,});
       { svelteHTML.createElement("div", { "class":`bar`,});
         { svelteHTML.createElement("span", { "class":`muted`,}); showing;                 }
         { svelteHTML.createElement("span", { "class":`grow`,}); }
         { svelteHTML.createElement("button", {     "class":`btn`,"disabled":!history.length || busy,"onclick":undo,});  }
         { svelteHTML.createElement("button", {     "class":`btn`,"disabled":busy,"onclick":() => show(editor.pedalLayout(), 'the pedal'),});   }
         { svelteHTML.createElement("button", {     "class":`btn`,"disabled":!isComplete(layout) || busy,"onclick":saveArrangement,});   }
         { svelteHTML.createElement("button", {     "class":`btn primary`,"disabled":!canWrite,"onclick":() => (confirming = true),}); changed.length; changed.length === 1 ? '' : 's';    }
       }

       { svelteHTML.createElement("div", { "class":`bar slot-tools`,});
        if(copyFrom !== null){
           { svelteHTML.createElement("span", {});     presetLabel(copyFrom + 1); presetName(layout[copyFrom]!);  }
           { svelteHTML.createElement("button", {   "class":`btn sm`,"onclick":() => (copyFrom = null),});  }
        } else if (selected === null){
           { svelteHTML.createElement("span", { "class":`muted small`,});                                 }
        }else{
           { svelteHTML.createElement("strong", {});presetLabel(selected + 1); layout[selected] ? presetName(layout[selected]!) : '—'; }
           { svelteHTML.createElement("button", {     "class":`btn sm`,"disabled":busy,"onclick":() => makeEmpty(selected!),});  }
           { svelteHTML.createElement("button", {     "class":`btn sm`,"disabled":!layout[selected] || busy,"onclick":() => (copyFrom = selected),});  }
           { svelteHTML.createElement("button", {     "class":`btn sm`,"disabled":!layout[selected] || busy,"onclick":() => rename(selected!),});  }
           { svelteHTML.createElement("label", {  "class":`btn sm`,});busy;
                
             { svelteHTML.createElement("input", {        "type":`file`,"accept":`.mo,application/json`,"hidden":true,"disabled":busy,"onchange":pickMo,});}
           }
        }
       }

      if(editor.original){
         { svelteHTML.createElement("div", { "class":`legend muted small`,});
               { svelteHTML.createElement("span", { "class":`mark modified`,});  }     
           { svelteHTML.createElement("span", { "class":`mark new`,});  }                
         }
      }

      if(tray.length){
         { svelteHTML.createElement("div", {   "class":`tray`,"aria-label":`Presets without a slot`,});
           { svelteHTML.createElement("strong", {});   }
              for(let t of __sveltets_2_ensureArray(tray)){let k = 1;k;
             { svelteHTML.createElement("span", {         "class":`chip`,"draggable":`true`,"role":`listitem`,"ondragstart":(e) => drag(e, `tray:${k}`),"title":t.file,});t.preset.name; }
          }
         }
      }

       { svelteHTML.createElement("div", { "class":`banks`,});
           for(let b of __sveltets_2_ensureArray((Array.from({ length: BANK_COUNT }, (_, b) => b)))){b;
           { svelteHTML.createElement("div", {  "class":`bank`,});dragOver === `bank:${b}`;
             { svelteHTML.createElement("div", {                 "class":`bank-title`,"draggable":!busy,"role":`button`,"tabindex":-1,"ondragstart":(e) => drag(e, `bank:${b}`),"ondragover":(e) => over(e, `bank:${b}`),"ondragleave":() => (dragOver = ''),"ondrop":(e) => dropOnBank(e, b),});
               b + 1;
             }
               for(let i of __sveltets_2_ensureArray((Array.from({ length: BANK_SIZE }, (_, k) => b * BANK_SIZE + k)))){i;
              const p = layout[i];
              const origin = editor.originOf(p);
               { svelteHTML.createElement("div", {                               "class":`slot`,"draggable":!!p && !busy,"role":`button`,"tabindex":0,"aria-pressed":selected === i,"title":p ? `${label(i)} ${p.name}` : `${label(i)} (no preset)`,"ondragstart":(e) => drag(e, `slot:${i}`),"ondragover":(e) => over(e, `slot:${i}`),"ondragleave":() => (dragOver = ''),"ondrop":(e) => dropOnSlot(e, i),"onclick":() => clickSlot(i),"onkeydown":(e) => e.key === 'Enter' && clickSlot(i),});changedSet.has(i + 1);!p;origin === 'empty';copyFrom !== null;dragOver === `slot:${i}`;selected === i;
                 { svelteHTML.createElement("span", { "class":`letter`,});'ABCD'[i % 4]; }
                 { svelteHTML.createElement("span", { "class":`name`,});p?.name ?? '—'; }
                if(origin === 'modified'){ { svelteHTML.createElement("span", {   "class":`mark modified`,"title":`Modified: the original has this name with another sound`,});  }} else if (origin === 'new'){ { svelteHTML.createElement("span", {   "class":`mark new`,"title":`New: not in the original set`,});  }}
               }
            }
           }
        }
       }
     }

     { svelteHTML.createElement("aside", { "class":`backups`,});
       { svelteHTML.createElement("h3", {});  }
       { svelteHTML.createElement("div", { "class":`actions`,});
         { svelteHTML.createElement("button", {     "class":`btn`,"disabled":editor.status !== 'ready' || busy,"onclick":backUpPedal,});     }
         { svelteHTML.createElement("label", { "class":`btn`,});    { svelteHTML.createElement("input", {      "type":`file`,"accept":`.json,application/json`,"hidden":true,"onchange":importFile,});} }
         { svelteHTML.createElement("button", {     "class":`btn`,"disabled":busy || !('showDirectoryPicker' in window),"onclick":importMoFolder,});      }
        if(!original){
           { svelteHTML.createElement("label", { "class":`btn`,});         { svelteHTML.createElement("input", {      "type":`file`,"accept":`.mr`,"hidden":true,"onchange":importFirmware,});} }
        }
       }
       { svelteHTML.createElement("ul", {});
           for(let b of __sveltets_2_ensureArray(backups)){b.id;
           { svelteHTML.createElement("li", { });b.locked;
             { svelteHTML.createElement("div", { "class":`bname`,});b.locked ? '🔒 ' : '';b.name; }
             { svelteHTML.createElement("div", { "class":`muted small`,});fmt(b.created);  b.source === 'factory' ? 'factory set, cannot be changed' : b.source; }
             { svelteHTML.createElement("div", { "class":`row`,});
               { svelteHTML.createElement("button", {     "class":`btn sm`,"disabled":busy,"onclick":() => show($state.snapshot(b.layout) as Layout, `the backup "${b.name}"`),});  }
               { svelteHTML.createElement("button", {   "class":`btn sm`,"onclick":() => download(b),});  }
               { svelteHTML.createElement("button", {       "class":`btn sm`,"disabled":!('showDirectoryPicker' in window),"title":`One .mo file per slot, named 01A …, into an empty folder`,"onclick":() => exportMoFiles(b),});   }
               { svelteHTML.createElement("button", {     "class":`btn sm`,"disabled":b.locked || busy,"onclick":() => remove(b),});  }
             }
           }
        }
           { svelteHTML.createElement("li", { "class":`muted`,});   }
        
       }
       { svelteHTML.createElement("p", { "class":`muted small`,});             }
     }
   }

  if(message){ { svelteHTML.createElement("p", {   "class":`message`,"role":`status`,});message; }}

  if(confirming){
     { svelteHTML.createElement("div", {     "class":`confirm`,"role":`alertdialog`,"aria-labelledby":`confirm-title`,});
       { svelteHTML.createElement("h3", { "id":`confirm-title`,}); changed.length; changed.length === 1 ? '' : 's';    }
       { svelteHTML.createElement("p", {});
           changed.length === 1 ? 'slot' : 'slots';
        changed.slice(0, 12).map((i) => presetLabel(i)).join(', ');changed.length > 12 ? ` and ${changed.length - 12} more` : '';
              estimate(changed.length);              
                       
       }
       { svelteHTML.createElement("p", { "class":`muted`,});            }
       { svelteHTML.createElement("div", { "class":`row`,});
         { svelteHTML.createElement("button", {   "class":`btn`,"onclick":() => (confirming = false),});  }
         { svelteHTML.createElement("button", {   "class":`btn primary`,"onclick":write,}); changed.length; changed.length === 1 ? '' : 's'; }
       }
     }
  }

  if(editor.writing){
    const w = editor.writing;
     { svelteHTML.createElement("div", {  "class":`progress`,});w.phase === 'failed';
       { svelteHTML.createElement("div", { "class":`ptext`,});
        if(w.phase === 'backup'){     } else if (w.phase === 'writing'){ w.slot ? presetLabel(w.slot) : ''; w.done + 1;  w.total;
        } else if (w.phase === 'verifying'){     } else if (w.phase === 'done'){ w.detail;
        } else if (w.phase === 'cancelled'){ w.detail;
        }else{  w.done;  w.total; w.detail;}
       }
       { svelteHTML.createElement("div", {         "class":`pbar`,"role":`progressbar`,"aria-valuemin":0,"aria-valuemax":w.total,"aria-valuenow":w.done,});
         { svelteHTML.createElement("div", { });__sveltets_2_ensureType(String, Number, `${w.total ? (w.done / w.total) * 100 : 0} `); }
       }
      if(w.phase === 'writing'){ { svelteHTML.createElement("button", {   "class":`btn sm`,"onclick":() => editor.cancelWrite(),});    }}
     }
  }
 }


};
return { props: {} as any as $$ComponentProps, exports: {}, bindings: __sveltets_$$bindings(''), slots: {}, events: {} }}
const ArrangeDialog__SvelteComponent_ = __sveltets_2_fn_component($$render());
/*Ωignore_startΩ*/type ArrangeDialog__SvelteComponent_ = ReturnType<typeof ArrangeDialog__SvelteComponent_>;
/*Ωignore_endΩ*/export default ArrangeDialog__SvelteComponent_;
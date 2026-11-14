// Application state shared by the UI components.
import { GE150Pro } from './device';
import { PRESET_COUNT, presetLabel, type ExpSettings, type ModuleState, type Preset } from './protocol/preset';
import { moToPreset, presetToMo, type MoFile } from './protocol/mo';
import type { Message } from './protocol/frame';
import type { GlobalEq, SystemSettings } from './protocol/system';
import type { Rhythm } from './protocol/rhythm';
import { runSelfTest, type CheckResult } from './selftest';
import { atSlot, changedSlots, isEmptyPreset, originOf, samePreset, type Layout, type Origin } from './arrange';
import { listBackups, ORIGINAL_ID, saveBackup } from './backups';

export interface WriteProgress {
  phase: 'backup' | 'writing' | 'verifying' | 'done' | 'cancelled' | 'failed';
  done: number;
  total: number;
  /** The slot being written (1-based). */
  slot?: number;
  detail?: string;
}

const SEND_INTERVAL_MS = 40;

export interface LogEntry {
  t: number;
  dir: 'in' | 'out';
  cmd: number;
  bytes: string;
}

class EditorState {
  device: GE150Pro | null = $state(null);
  status: 'disconnected' | 'connecting' | 'loading' | 'ready' | 'error' = $state('disconnected');
  error = $state('');
  presets: (Preset | undefined)[] = $state(Array(PRESET_COUNT));
  current = $state(0);
  /** Live (possibly unsaved) state of the current preset. */
  live: Preset | null = $state(null);
  dirty = $state(false);
  demo = $state(false);
  system: SystemSettings | null = $state(null);
  globalEq: GlobalEq | null = $state(null);
  spillOver: boolean | null = $state(null);
  /** Results of the last device self-test (null = never run, [] = running). */
  selfTest: CheckResult[] | null = $state(null);
  /** Drum machine state as reported by the pedal (read-only). */
  rhythm: Rhythm | null = $state(null);
  log: LogEntry[] = $state([]);
  /** Module slot shown in the parameter panel (0 = FX/COMP … 8 = REVERB). */
  selectedSlot = $state(2);
  /** .mo files in the user-chosen local folder ("COMPUTER" panel). */
  localFiles: { name: string; handle: FileSystemFileHandle }[] = $state([]);
  localSelected = $state('');
  private folder: FileSystemDirectoryHandle | null = null;

  /** A write of an arrangement to the pedal: its progress, or null when none ran. */
  writing: WriteProgress | null = $state(null);
  /** The locked original backup (the factory set), if this browser has one. */
  original: Layout | null = $state.raw(null);
  private stopWriting = false;

  private pending = new Map<number, ModuleState>();
  private timers = new Map<number, ReturnType<typeof setTimeout>>();

  get loaded() {
    return this.presets.filter(Boolean).length;
  }

  async connect(reuse = false) {
    this.error = '';
    try {
      this.status = 'connecting';
      const dev = reuse ? await GE150Pro.previouslyGranted() : await GE150Pro.request();
      if (!dev) {
        this.status = 'disconnected';
        return;
      }
      this.wire(dev);
      this.device = dev;
      this.status = 'loading';
      try {
        await dev.open();
      } catch (e) {
        this.device = null;
        throw new Error(
          `Could not open the GE150 Pro (${e instanceof Error ? e.message : e}). It is probably in use by the official GE150PRO app or another browser tab; close that and connect again.`,
        );
      }
    } catch (e) {
      this.fail(e);
    }
  }

  /** Offline mode (?demo): generated presets, nothing is sent to hardware. */
  async loadDemo() {
    const { demoPresets } = await import('./demo');
    const presets = demoPresets();
    // the demo's own "original": the generated set; two presets differ from it, to show the M and N marks
    this.demo = true;
    this.original = demoPresets();
    presets[5].modules[2] = { ...presets[5].modules[2], values: presets[5].modules[2].values.map((v, k) => (k === 0 ? Math.max(0, v - 7) : v)) };
    presets[9] = { ...presets[9], name: 'My Tone' };
    presets.forEach((p, i) => (this.presets[i] = p));
    this.status = 'ready';
    this.adoptCurrent(1);
  }

  async disconnect() {
    await this.device?.close();
    this.device = null;
    this.status = 'disconnected';
  }

  private wire(dev: GE150Pro) {
    dev.on('preset', (p) => {
      this.presets[p.index - 1] = p;
      if (p.index === this.current && !this.dirty) this.live = structuredClone($state.snapshot(p));
      if (this.loaded === PRESET_COUNT && this.status === 'loading') {
        this.status = 'ready';
        // The live-state answers to the connect sequence's B0 arrive before the preset dump has
        // finished, so ask again now that the stored copy exists to compare against.
        dev.requestCurrent();
      }
    });
    dev.on('current', (index) => this.adoptCurrent(index));
    dev.on('system', (s) => (this.system = s));
    // Changed on the pedal itself: update the UI only, never echo back.
    dev.on('systemChange', (patch) => {
      if (this.system) this.system = { ...this.system, ...patch };
    });
    dev.on('exp', (patch) => {
      if (!this.live) return;
      this.live.exp = { ...this.live.exp, ...patch };
      this.markDirtyIfChanged();
    });
    dev.on('rhythm', (r) => (this.rhythm = r));
    dev.on('globalEq', (eq) => (this.globalEq = eq));
    dev.on('spillOver', (on) => (this.spillOver = on));
    dev.on('module', (slot, m) => {
      if (!this.live) return;
      this.live.modules[slot] = m;
      this.markDirtyIfChanged();
    });
    dev.on('stored', (index) => {
      if (this.live && this.live.index === index) {
        this.presets[index - 1] = structuredClone($state.snapshot(this.live));
        this.dirty = false;
      }
    });
    dev.on('message', (m: Message, dir) => {
      const bytes = [...m.payload.slice(0, 24)].map((b) => b.toString(16).padStart(2, '0')).join(' ');
      this.log = [{ t: Date.now(), dir, cmd: m.cmd, bytes }, ...this.log].slice(0, 200);
    });
    dev.on('disconnect', () => {
      this.device = null;
      this.status = 'disconnected';
    });
    dev.on('error', (e) => this.fail(e));
  }

  /** Live state reported by the pedal differs from the stored preset: unsaved changes exist. */
  private markDirtyIfChanged() {
    const live = this.live;
    const stored = live && this.presets[live.index - 1];
    if (!live || !stored || this.dirty) return;
    const sig = (p: Preset) => JSON.stringify([$state.snapshot(p.modules), $state.snapshot(p.exp)]);
    if (sig(live) !== sig(stored)) this.dirty = true;
  }

  private adoptCurrent(index: number) {
    if (index < 1 || index > PRESET_COUNT) return;
    this.current = index;
    const p = this.presets[index - 1];
    this.live = p ? structuredClone($state.snapshot(p)) : null;
    this.dirty = false;
  }

  async select(index: number) {
    if (!this.device && !this.demo) return;
    await this.device?.selectPreset(index);
    this.adoptCurrent(index);
  }

  /** Real-time edit: update local state now, send at most once per interval per slot. */
  editModule(slot: number, m: ModuleState) {
    if (!this.live || (!this.device && !this.demo)) return;
    this.live.modules[slot] = m;
    this.dirty = true;
    this.pending.set(slot, $state.snapshot(m) as ModuleState);
    if (this.timers.has(slot)) return;
    const flush = () => {
      const next = this.pending.get(slot);
      this.pending.delete(slot);
      if (!next) {
        this.timers.delete(slot);
        return;
      }
      this.device?.setModule(slot, next);
      this.timers.set(slot, setTimeout(flush, SEND_INTERVAL_MS));
    };
    flush();
  }

  /** Set/read-back/restore checks against the pedal; leaves the live state and dirty flag as found. */
  async runSelfTest() {
    const dev = this.device;
    if (!dev || this.selfTest?.length === 0) return;
    const dirty = this.dirty;
    this.selfTest = [];
    try {
      await runSelfTest(dev, (r) => (this.selfTest = [...(this.selfTest ?? []), r]));
    } finally {
      this.dirty = dirty;
    }
  }

  /** Real-time EXP edit of the current preset (not stored until store()). */
  editExp(patch: Partial<ExpSettings>) {
    if (!this.live || (!this.device && !this.demo)) return;
    const exp = { ...this.live.exp, ...patch };
    this.live.exp = exp;
    this.dirty = true;
    const d = this.device;
    if (!d) return;
    if ('MODULE_CTRL' in patch || 'PARA_CTRL' in patch || 'FUN_SWITCH' in patch) d.setExpFunction(exp);
    if ('VOL_SWITCH' in patch || 'VOL_MIN' in patch || 'VOL_MAX' in patch) {
      this.throttled('expvol', () => d.setExpVolume($state.snapshot(this.live!.exp) as ExpSettings));
    }
  }

  async store(name?: string) {
    if (!this.live || !this.device) return;
    if (name !== undefined) this.live.name = name.slice(0, 16);
    await this.device.storePreset($state.snapshot(this.live) as Preset);
  }

  async rename(name: string) {
    if (!this.live || !this.device) return;
    const trimmed = name.slice(0, 16);
    await this.device.renamePreset(this.live.index, trimmed);
    this.live.name = trimmed;
    const stored = this.presets[this.live.index - 1];
    if (stored) stored.name = trimmed;
  }

  exportMo(): { filename: string; json: string } | null {
    if (!this.live) return null;
    const mo = presetToMo($state.snapshot(this.live) as Preset);
    return { filename: `${this.live.name || 'preset'}.mo`, json: JSON.stringify(mo, null, 4) };
  }

  /** Load a .mo file into the current slot as live (unsaved) edits and send it to the device. */
  importMo(text: string) {
    if (!this.live) throw new Error('select a preset first');
    const p = moToPreset(JSON.parse(text) as MoFile, this.live.index);
    p.modules.forEach((m, slot) => this.editModule(slot, m));
    this.live.name = p.name;
    this.editExp(p.exp);
  }

  /** Apply one system setting locally and send it (system settings take effect immediately). */
  updateSystem(patch: Partial<SystemSettings>) {
    if (!this.system) return;
    const next = { ...this.system, ...patch };
    this.system = next;
    const d = this.device;
    if (!d) return;
    if (patch.inputLevel !== undefined) this.throttled('input', () => d.setInputLevel(next.inputLevel));
    if (patch.brightness !== undefined) this.throttled('bright', () => d.setBrightness(next.brightness));
    if (patch.otgLevel !== undefined) this.throttled('otg', () => d.setOtgLevel(next.otgLevel));
    if (patch.cabLeft !== undefined || patch.cabRight !== undefined) d.setCabOut(next.cabLeft, next.cabRight);
    if (patch.language !== undefined) d.setLanguage(next.language);
  }

  updateGlobalEq(eq: GlobalEq) {
    this.globalEq = eq;
    const d = this.device;
    if (d) this.throttled('eq', () => d.setGlobalEq($state.snapshot(this.globalEq!) as GlobalEq));
  }

  setSpillOver(on: boolean) {
    this.spillOver = on;
    this.device?.setSpillOver(on);
  }

  /** Latest pending send per key while that key is cooling down; null = cooling down, nothing pending. */
  private pendingSends = new Map<string, (() => void) | null>();

  /** Send immediately, then at most once per interval with the latest value. */
  private throttled(key: string, send: () => void) {
    if (this.pendingSends.has(key)) {
      this.pendingSends.set(key, send);
      return;
    }
    send();
    this.pendingSends.set(key, null);
    const tick = () => {
      const next = this.pendingSends.get(key);
      if (next) {
        this.pendingSends.set(key, null);
        next();
        setTimeout(tick, SEND_INTERVAL_MS);
      } else this.pendingSends.delete(key);
    };
    setTimeout(tick, SEND_INTERVAL_MS);
  }

  /** Whole-device backup as JSON: every preset in .mo form plus system settings. */
  exportBackup(): { filename: string; json: string } | null {
    if (this.loaded === 0) return null;
    const presets = $state.snapshot(this.presets) as (Preset | undefined)[];
    const data = {
      format: 'ge150pro-web-backup',
      version: 1,
      created: new Date().toISOString(),
      system: $state.snapshot(this.system),
      globalEq: $state.snapshot(this.globalEq),
      spillOver: this.spillOver,
      presets: presets.map((p, i) => (p ? { index: i + 1, mo: presetToMo(p) } : null)),
    };
    const stamp = data.created.slice(0, 19).replace(/[:T]/g, '-');
    return { filename: `GE150PRO-backup-${stamp}.json`, json: JSON.stringify(data, null, 1) };
  }

  async loadOriginal() {
    let original: Layout | null = null;
    try {
      original = (await listBackups()).find((b) => b.id === ORIGINAL_ID)?.layout ?? null;
    } catch {
      // no IndexedDB (private window): no original
    }
    if (!this.demo) this.original = original; // the demo brings its own
  }

  /** How a preset relates to the original set (null without an original). */
  originOf(p: Preset | null | undefined): Origin | null {
    if (!p) return null;
    if (isEmptyPreset(p)) return 'empty';
    return this.original ? originOf(p, this.original) : null;
  }

  /** What the pedal holds now, as a layout. */
  pedalLayout(): Layout {
    return ($state.snapshot(this.presets) as (Preset | undefined)[]).map((p) => p ?? null);
  }

  /**
   * Write every slot whose preset differs in `target` (select it, store, wait for the acknowledgement), after saving
   * a backup of the pedal as it is. Then read every preset back and compare. Stops between presets on cancelWrite().
   */
  async writeLayout(target: Layout) {
    if (this.writing && ['backup', 'writing', 'verifying'].includes(this.writing.phase)) return;
    const pedal = this.pedalLayout();
    if (pedal.some((p) => !p)) throw new Error('the presets have not all loaded yet');
    const slots = changedSlots(pedal, target);
    const total = slots.length;
    this.stopWriting = false;
    const back = this.current;
    const written: number[] = [];
    try {
      this.writing = { phase: 'backup', done: 0, total };
      // (demo mode has no pedal to back up, and shares this browser's backups with the real editor)
      if (this.device) await saveBackup({ name: 'Pedal before writing', source: 'pedal', locked: false, layout: pedal });
      for (const i of slots) {
        if (this.stopWriting) break;
        this.writing = { phase: 'writing', done: written.length, total, slot: i };
        const p = atSlot(target[i - 1]!, i);
        if (this.device) await this.device.writePreset(p);
        else await new Promise((r) => setTimeout(r, 25)); // demo: no pedal
        this.presets[i - 1] = p;
        written.push(i);
      }
      if (this.device) await this.device.selectPreset(back);
      this.adoptCurrent(back);
      const cancelled = this.stopWriting;
      this.writing = { phase: 'verifying', done: written.length, total };
      const wrong = await this.verify(target, written);
      if (wrong.length) throw new Error(`read back differs in ${wrong.length} slot(s): ${wrong.slice(0, 8).join(', ')}`);
      this.writing = {
        phase: cancelled ? 'cancelled' : 'done',
        done: written.length,
        total,
        detail: cancelled ? `Stopped after ${written.length} of ${total}; the backup holds the pedal as it was.` : `${written.length} presets written and read back.`,
      };
    } catch (e) {
      this.writing = { phase: 'failed', done: written.length, total, detail: e instanceof Error ? e.message : String(e) };
    }
  }

  cancelWrite() {
    this.stopWriting = true;
  }

  /** Read every preset again (the connect sequence) and list written slots that differ from the target. */
  private async verify(target: Layout, written: number[]): Promise<string[]> {
    if (this.device) {
      await this.disconnect();
      this.presets = Array(PRESET_COUNT);
      await this.connect(true);
      const end = Date.now() + 20000;
      while (this.status !== 'ready') {
        if (this.status === 'error' || Date.now() > end) throw new Error('could not read the presets back');
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    return written.filter((i) => !samePreset(this.presets[i - 1], target[i - 1])).map((i) => presetLabel(i));
  }

  /** Step to the previous/next preset, wrapping around 1..200. */
  step(delta: number) {
    const from = this.current || 1;
    return this.select(((from - 1 + delta + PRESET_COUNT) % PRESET_COUNT) + 1);
  }

  static folderSupported() {
    return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
  }

  async chooseFolder() {
    this.folder = await (window as unknown as { showDirectoryPicker(o?: object): Promise<FileSystemDirectoryHandle> }).showDirectoryPicker({ id: 'ge150-presets' });
    await this.refreshFolder();
  }

  async refreshFolder() {
    if (!this.folder) return;
    const files: { name: string; handle: FileSystemFileHandle }[] = [];
    for await (const entry of (this.folder as unknown as { values(): AsyncIterable<FileSystemHandle> }).values()) {
      if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.mo')) {
        files.push({ name: entry.name.replace(/\.mo$/i, ''), handle: entry as FileSystemFileHandle });
      }
    }
    this.localFiles = files.sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Load a local .mo into the current preset as live, unsaved edits. */
  async loadLocal(name: string) {
    const f = this.localFiles.find((x) => x.name === name);
    if (!f) return;
    this.importMo(await (await f.handle.getFile()).text());
    this.localSelected = name;
  }

  revert() {
    this.adoptCurrent(this.current);
    // Restore the device's live state to the stored preset.
    this.live?.modules.forEach((m, slot) => this.device?.setModule(slot, $state.snapshot(m) as ModuleState));
    if (this.live && this.device) {
      const exp = $state.snapshot(this.live.exp) as ExpSettings;
      this.device.setExpFunction(exp);
      this.device.setExpVolume(exp);
    }
  }

  private fail(e: unknown) {
    this.error = e instanceof Error ? e.message : String(e);
    this.status = 'error';
  }
}

export const editor = new EditorState();

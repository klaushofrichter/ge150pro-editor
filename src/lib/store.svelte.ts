// Application state shared by the UI components.
import { GE150Pro } from './device';
import { NAME_LENGTH, PRESET_COUNT, presetLabel, type ExpSettings, type ModuleState, type Preset } from './protocol/preset';
import { moToPreset, presetToMo, type MoFile } from './protocol/mo';
import type { Message } from './protocol/frame';
import type { GlobalEq, SystemSettings } from './protocol/system';
import type { Rhythm } from './protocol/rhythm';
import { runSelfTest, type CheckResult } from './selftest';
import { atSlot, backupFileName, changedSlots, trimName, layoutToFile, originsFrom, samePreset, type Layout, type Origin } from './arrange';
import { dirFiles, errorText, pickDirectory } from './files';
import { expTarget } from './catalog';
import { turnedOnPedal, withoutPedalMove } from './exp';
import { originalFor } from './diff';
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

/** After a request of ours (connect, select, B0), reports answer it rather than show the pedal's own controls. */
const QUIET_MS = 1500;
const PEDAL_ADVICE =
  'While the editor is connected, change things in the editor only: the pedal and the editor get out of step, and unsaved changes can be lost. The expression pedal and its toe switch are fine to use.';

export interface LogEntry {
  /** Increasing per message: the list's key. */
  seq: number;
  t: number;
  dir: 'in' | 'out';
  cmd: number;
  bytes: string;
}

/** Why opening fails: on Linux usually missing permission for the pedal's hidraw device, elsewhere another program. */
export function openHint(ua = typeof navigator === 'undefined' ? '' : navigator.userAgent): string {
  const inUse = 'It is probably in use by the official GE150PRO app or another browser tab; close that and connect again.';
  if (!/Linux/.test(ua) || /Android|CrOS/.test(ua)) return inUse;
  return 'On Linux this usually means Chrome lacks permission to open the pedal: add the udev rule from the README ("Linux" under Requirements), then unplug and replug the pedal. Otherwise another program or browser tab uses it; close that and connect again.';
}

class EditorState {
  device: GE150Pro | null = $state(null);
  status: 'disconnected' | 'connecting' | 'loading' | 'ready' | 'error' = $state('disconnected');
  error = $state('');
  /**
   * The presets on the pedal. Values, not editable state: a change replaces the array (setPreset), never a preset in
   * place, so comparisons can cache by object (arrange.ts, samePreset) and copies keep identities.
   */
  presets: (Preset | undefined)[] = $state.raw(Array(PRESET_COUNT));
  current = $state(0);
  /** Live (possibly unsaved) state of the current preset. */
  live: Preset | null = $state(null);
  dirty = $state(false);
  /**
   * The pedal's mode now, set by its toe switch: 1 expression, 0 volume (FUN_SWITCH as the pedal reports it in `18`).
   * A live control like the pedal itself: it changes neither `live` nor `dirty`; the preset keeps its stored mode.
   */
  expMode: number | null = $state(null);
  /** The parameter the expression pedal moves was changed here (not by the pedal), so Store keeps the new value. */
  private expEdited = false;
  /** A warning that the pedal's own buttons or knobs were used (null when there is none to show). */
  pedalNotice: string | null = $state(null);
  /** The general warning was shown for this connection. */
  private pedalWarned = false;
  /** Until then (performance.now()), reports answer one of our requests. */
  private quietUntil = 0;
  demo = $state(false);
  system: SystemSettings | null = $state(null);
  globalEq: GlobalEq | null = $state(null);
  spillOver: boolean | null = $state(null);
  /** Results of the last device self-test (null = never run, [] = running). */
  selfTest: CheckResult[] | null = $state(null);
  /** Drum machine state as reported by the pedal (read-only). */
  rhythm: Rhythm | null = $state(null);
  log: LogEntry[] = $state.raw([]);
  private logSeq = 0;
  /** Module slot shown in the parameter panel (0 = FX/COMP … 8 = REVERB). */
  selectedSlot = $state(2);
  /** .mo files in the user-chosen local folder ("COMPUTER" panel). */
  localFiles: { name: string; handle: FileSystemFileHandle }[] = $state([]);
  localSelected = $state('');
  private folder: FileSystemDirectoryHandle | null = null;

  /** A write of an arrangement to the pedal: its progress, or null when none ran. */
  writing: WriteProgress | null = $state(null);
  /** The locked original backup (the factory set), if this browser has one; set it with setOriginal(). */
  original: Layout | null = $state.raw(null);
  private origins = $state.raw(originsFrom(null));
  private stopWriting = false;

  /** A pedal is connected, or the demo runs. */
  get online() {
    return !!this.device || this.demo;
  }

  private setPreset(index: number, p: Preset) {
    if (!Number.isInteger(index) || index < 1 || index > PRESET_COUNT) return; // not a slot (a malformed report)
    this.presets = this.presets.with(index - 1, p);
  }

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
        this.settleReady(new Error('no pedal found'));
        return;
      }
      this.wire(dev);
      this.device = dev;
      this.pedalNotice = null;
      this.pedalWarned = false;
      this.status = 'loading';
      try {
        await dev.open();
      } catch (e) {
        this.device = null;
        throw new Error(`Could not open the GE150 Pro (${errorText(e)}). ${openHint()}`);
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
    this.setOriginal(structuredClone(presets));
    presets[5].modules[2] = { ...presets[5].modules[2], values: presets[5].modules[2].values.map((v, k) => (k === 0 ? Math.max(0, v - 7) : v)) };
    presets[9] = { ...presets[9], name: 'My Tone' };
    this.presets = presets;
    this.status = 'ready';
    this.adoptCurrent(1);
  }

  async disconnect() {
    this.dropPendingSends();
    await this.device?.close();
    this.device = null;
    this.status = 'disconnected';
  }

  private wire(dev: GE150Pro) {
    dev.on('preset', (p) => {
      this.setPreset(p.index, p);
      if (p.index === this.current && !this.dirty) this.live = structuredClone(p);
      if (this.loaded === PRESET_COUNT && this.status === 'loading') {
        this.status = 'ready';
        this.settleReady();
        // The live-state answers to the connect sequence's B0 arrive before the preset dump has
        // finished, so ask again now that the stored copy exists to compare against.
        this.quiet();
        dev.requestCurrent();
      }
    });
    dev.on('switched', (index) => {
      const name = this.dirty && this.live ? trimName(this.live.name) || presetLabel(this.live.index) : null;
      this.pedalControlsUsed(name ? `The pedal switched presets itself, so the unsaved changes to "${name}" are gone.` : 'The pedal switched presets itself.', true);
      this.adoptCurrent(index);
    });
    dev.on('current', (index) => this.adoptCurrent(index));
    dev.on('system', (s) => (this.system = s));
    // Changed on the pedal itself: update the UI only, never echo back.
    dev.on('systemChange', (patch) => {
      if (this.system) this.system = { ...this.system, ...patch };
      this.pedalControlsUsed("A setting was changed in the pedal's menu.");
    });
    dev.on('exp', ({ FUN_SWITCH, ...rest }) => {
      if (FUN_SWITCH !== undefined) this.expMode = FUN_SWITCH; // the toe switch (or a report of the current mode)
      if (!this.live || Object.keys(rest).length === 0) return;
      const exp = this.live.exp;
      if (Object.entries(rest).some(([k, v]) => exp[k as keyof ExpSettings] !== v)) this.pedalControlsUsed("The EXP settings were changed in the pedal's menu.");
      this.live.exp = { ...this.live.exp, ...rest };
      this.markDirtyIfChanged();
    });
    dev.on('rhythm', (r) => (this.rhythm = r));
    dev.on('globalEq', (eq) => (this.globalEq = eq));
    dev.on('spillOver', (on) => (this.spillOver = on));
    dev.on('module', (slot, m) => {
      if (!this.live) return;
      if (turnedOnPedal(this.live, slot, m)) this.pedalControlsUsed("A knob or switch on the pedal was used.");
      this.live.modules[slot] = m;
      this.markDirtyIfChanged();
    });
    dev.on('stored', (index) => {
      const kept = this.storable();
      if (kept && kept.index === index) {
        const live = $state.snapshot(this.live) as Preset;
        this.setPreset(index, kept);
        this.expEdited = false;
        this.dirty = false;
        // Storing also loads the stored values into the sound (observed 2026-11-14): put back the value the expression
        // pedal had set, so the sound stays where the foot is
        const moved = kept.modules.findIndex((m, s) => m !== live.modules[s] && m.values.some((v, i) => v !== live.modules[s].values[i]));
        if (moved >= 0) dev.setModule(moved, live.modules[moved]);
      }
    });
    dev.on('message', (m: Message, dir) => {
      const bytes = [...m.payload.slice(0, 24)].map((b) => b.toString(16).padStart(2, '0')).join(' ');
      this.log = [{ seq: ++this.logSeq, t: Date.now(), dir, cmd: m.cmd, bytes }, ...this.log.slice(0, 199)];
    });
    dev.on('disconnect', () => {
      this.device = null;
      this.status = 'disconnected';
      this.settleReady(new Error('the pedal was disconnected'));
    });
    dev.on('error', (e) => this.fail(e));
  }

  /**
   * The live preset as Store keeps it. Where the expression pedal has moved its parameter, that is playing, not an
   * edit: the stored value stays (unless the parameter was changed here). The toe-switch mode never reaches `live`.
   */
  private storable(): Preset | null {
    if (!this.live) return null;
    const p = $state.snapshot(this.live) as Preset;
    return this.expEdited ? p : withoutPedalMove(p, this.presets[p.index - 1]);
  }

  /** Reports in the next QUIET_MS answer a request of ours. */
  private quiet() {
    this.quietUntil = Math.max(this.quietUntil, performance.now() + QUIET_MS);
  }

  /**
   * The pedal's own controls were used. `what` says how; the advice follows. Reports answering our own requests, a
   * write in progress and the loading at connect do not count. A preset switch with lost changes is always told; other
   * uses once per connection.
   */
  private pedalControlsUsed(what: string, always = false) {
    const writing = this.writing && ['backup', 'writing', 'verifying'].includes(this.writing.phase);
    if (!always && (this.status !== 'ready' || writing || performance.now() < this.quietUntil)) return;
    if (!always && this.pedalWarned) return;
    this.pedalWarned = true;
    this.pedalNotice = `${what} ${PEDAL_ADVICE}`;
  }

  dismissPedalNotice() {
    this.pedalNotice = null;
  }

  /** Live state reported by the pedal differs from the stored preset: unsaved changes exist. */
  private markDirtyIfChanged() {
    const live = this.storable();
    const stored = live && this.presets[live.index - 1];
    if (!live || !stored || this.dirty) return;
    const sig = (p: Preset) => JSON.stringify([p.modules, p.exp]);
    if (sig(live) !== sig(stored)) this.dirty = true;
  }

  private adoptCurrent(index: number) {
    if (index < 1 || index > PRESET_COUNT) return;
    if (index !== this.current) this.dropPendingSends(); // edits of the preset left behind must not reach the new one
    this.current = index;
    const p = this.presets[index - 1];
    this.live = p ? structuredClone(p) : null;
    this.expMode = p ? p.exp.FUN_SWITCH : null; // until the pedal reports otherwise
    this.expEdited = false;
    this.dirty = false;
  }

  async select(index: number) {
    if (!this.online) return;
    this.dropPendingSends();
    // the editor switches first, so edits made while the pedal loads the preset (SELECT_SETTLE_MS) belong to the new
    // preset, which is where the device queue delivers them
    this.adoptCurrent(index);
    this.quiet();
    await this.device?.selectPreset(index);
  }

  /** Real-time edit: update local state now, send at most once per interval per slot. */
  editModule(slot: number, m: ModuleState) {
    if (!this.live || !this.online) return;
    const t = expTarget(this.live.exp, this.live.modules);
    if (t?.spec && t.slot === slot && m.values[t.spec.pos] !== this.live.modules[slot].values[t.spec.pos]) this.expEdited = true;
    this.live.modules[slot] = m;
    this.dirty = true;
    const send = $state.snapshot(m) as ModuleState;
    this.throttled(`module${slot}`, () => this.device?.setModule(slot, send));
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

  /**
   * Play the expression pedal from the editor: set the parameter it moves, as the pedal would. Like the pedal, this is
   * playing, not an edit (no unsaved change; Store keeps the preset's value). Only in EXP mode, as on the pedal.
   */
  playExp(raw: number) {
    const live = this.live;
    if (!live || !this.online || this.expMode !== 1) return;
    const t = expTarget(live.exp, live.modules);
    if (!t?.spec) return;
    const m = { ...live.modules[t.slot], values: live.modules[t.slot].values.with(t.spec.pos, raw) };
    live.modules[t.slot] = m;
    const send = $state.snapshot(m) as ModuleState;
    this.throttled(`module${t.slot}`, () => this.device?.setModule(t.slot, send));
  }

  /** The toe switch from the editor: EXP or volume mode now. The preset keeps its own mode (FUNCTION). */
  toe() {
    const live = this.live;
    if (!live || !this.online) return;
    const mode = this.expMode === 1 ? 0 : 1;
    this.expMode = mode;
    this.device?.setExpFunction({ ...($state.snapshot(live.exp) as ExpSettings), FUN_SWITCH: mode });
  }

  /** Real-time EXP edit of the current preset (not stored until store()). */
  editExp(patch: Partial<ExpSettings>) {
    if (!this.live || !this.online) return;
    const exp = { ...this.live.exp, ...patch };
    this.live.exp = exp;
    if (patch.FUN_SWITCH !== undefined) this.expMode = patch.FUN_SWITCH;
    this.dirty = true;
    const d = this.device;
    if (!d) return;
    if ('MODULE_CTRL' in patch || 'PARA_CTRL' in patch || 'FUN_SWITCH' in patch) d.setExpFunction(exp);
    if ('VOL_SWITCH' in patch || 'VOL_MIN' in patch || 'VOL_MAX' in patch) {
      const send = $state.snapshot(exp) as ExpSettings;
      this.throttled('expvol', () => d.setExpVolume(send));
    }
  }

  /** Store the current preset; resolves once the pedal has acknowledged it. */
  async store(name?: string) {
    const dev = this.device;
    if (!this.live || (!dev && !this.demo)) return;
    if (name !== undefined) this.live.name = name.slice(0, NAME_LENGTH);
    const index = this.live.index;
    if (!dev) {
      // the demo has no pedal: keep the preset here, as a store would
      this.setPreset(index, this.storable()!);
      this.expEdited = false;
      this.dirty = false;
      return;
    }
    let ack!: (i: number) => void;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const acked = new Promise<void>((resolve, reject) => {
      ack = (i) => i === index && resolve();
      timer = setTimeout(() => reject(new Error('the pedal did not acknowledge it')), 3000);
    });
    dev.on('stored', ack);
    try {
      await dev.storePreset(this.storable()!);
      await acked;
    } finally {
      clearTimeout(timer);
      dev.off('stored', ack);
    }
  }

  async rename(name: string) {
    if (!this.live || !this.device) return;
    const trimmed = name.slice(0, NAME_LENGTH);
    await this.device.renamePreset(this.live.index, trimmed);
    this.live.name = trimmed;
    const stored = this.presets[this.live.index - 1];
    if (stored) this.setPreset(this.live.index, { ...stored, name: trimmed });
  }

  exportMo(): { filename: string; json: string } | null {
    const p = this.storable();
    if (!p) return null;
    const mo = presetToMo(p);
    return { filename: `${p.name || 'preset'}.mo`, json: JSON.stringify(mo, null, 4) };
  }

  /** Load a .mo file into the current slot as live (unsaved) edits and send it to the device. */
  importMo(text: string) {
    if (!this.live) throw new Error('select a preset first');
    this.applyAsEdits(moToPreset(JSON.parse(text) as MoFile, this.live.index));
  }

  /** Another preset's sound and name into the current slot, as live (unsaved) edits sent to the device. */
  private applyAsEdits(p: Preset) {
    if (!this.live) return;
    p.modules.forEach((m, slot) => this.editModule(slot, structuredClone(m)));
    this.live.name = p.name;
    this.editExp({ ...p.exp });
  }

  /** The original preset with the current preset's name (null without an original set or such a name). */
  get originalPreset(): Preset | null {
    return this.live ? originalFor(this.live, this.original) : null;
  }

  /** The original preset's sound into the current slot as unsaved edits; Save stores it, Revert goes back. */
  restoreOriginal() {
    const o = this.originalPreset;
    if (o) this.applyAsEdits(o);
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

  /** Forget sends still waiting in the throttle (another preset, a revert, a disconnect). */
  private dropPendingSends() {
    this.pendingSends.clear();
    this.sendGeneration++;
  }
  private sendGeneration = 0;

  /** Send immediately, then at most once per interval with the latest value. */
  private throttled(key: string, send: () => void) {
    if (this.pendingSends.has(key)) {
      this.pendingSends.set(key, send);
      return;
    }
    send();
    this.pendingSends.set(key, null);
    const generation = this.sendGeneration;
    const tick = () => {
      if (generation !== this.sendGeneration) return; // dropped (dropPendingSends): this chain ends
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
    const created = new Date().toISOString();
    const name = 'Pedal and system settings';
    const data = {
      ...layoutToFile(this.pedalLayout(), name, created),
      system: $state.snapshot(this.system),
      globalEq: $state.snapshot(this.globalEq),
      spillOver: this.spillOver,
    };
    return { filename: backupFileName(name, created), json: JSON.stringify(data, null, 1) };
  }

  async loadOriginal() {
    let original: Layout | null = null;
    try {
      original = (await listBackups()).find((b) => b.id === ORIGINAL_ID)?.layout ?? null;
    } catch {
      // no IndexedDB (private window): no original
    }
    if (!this.demo) this.setOriginal(original); // the demo brings its own
  }

  private setOriginal(original: Layout | null) {
    this.original = original;
    this.origins = originsFrom(original);
  }

  /** How a preset relates to the original set: empty, original, modified or new (null without an original). */
  originOf(p: Preset | null | undefined): Origin | null {
    return this.origins(p);
  }

  /** A write to the pedal is running. */
  get busy() {
    return !!this.writing && ['backup', 'writing', 'verifying'].includes(this.writing.phase);
  }

  /** What the pedal holds now, as a layout. */
  pedalLayout(): Layout {
    return this.presets.map((p) => p ?? null);
  }

  /**
   * Write every slot whose preset differs in `target` (select it, store, wait for the acknowledgement), after saving
   * a backup of the pedal as it is. Then read every preset back and compare. Stops between presets on cancelWrite().
   */
  async writeLayout(target: Layout) {
    if (this.busy) return;
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
        this.setPreset(i, p);
        written.push(i);
      }
      if (back >= 1) {
        // back to the preset that was selected before the write
        if (this.device) await this.device.selectPreset(back);
        this.adoptCurrent(back);
      }
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
      this.writing = { phase: 'failed', done: written.length, total, detail: errorText(e) };
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
      const loaded = this.whenReady(20000);
      await this.connect(true);
      try {
        await loaded;
      } catch (e) {
        throw new Error(`could not read the presets back: ${errorText(e)}`);
      }
    }
    return written.filter((i) => !samePreset(this.presets[i - 1], target[i - 1])).map((i) => presetLabel(i));
  }

  /** The previous/next preset, wrapping around 1..200. */
  neighbor(delta: number) {
    const from = this.current || 1;
    return ((from - 1 + delta + PRESET_COUNT) % PRESET_COUNT) + 1;
  }

  async chooseFolder() {
    const dir = await pickDirectory('ge150-presets');
    if (!dir) return;
    this.folder = dir;
    await this.refreshFolder();
  }

  async refreshFolder() {
    if (!this.folder) return;
    const files: { name: string; handle: FileSystemFileHandle }[] = [];
    for await (const f of dirFiles(this.folder)) {
      if (f.name.toLowerCase().endsWith('.mo')) files.push({ name: f.name.replace(/\.mo$/i, ''), handle: f });
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
    this.dropPendingSends();
    this.adoptCurrent(this.current);
    // Restore the device's live state to the stored preset.
    this.live?.modules.forEach((m, slot) => this.device?.setModule(slot, $state.snapshot(m) as ModuleState));
    if (this.live && this.device) {
      const exp = $state.snapshot(this.live.exp) as ExpSettings;
      this.device.setExpFunction(exp);
      this.device.setExpVolume(exp);
    }
  }

  /** Who waits for all presets to load (whenReady). */
  private readyWaiters: { resolve: () => void; reject: (e: Error) => void }[] = [];

  /** Resolves once all presets have loaded; rejects on a failure, a disconnect or after `timeoutMs`. */
  whenReady(timeoutMs: number): Promise<void> {
    if (this.status === 'ready') return Promise.resolve();
    return new Promise((resolve, reject) => {
      const waiter = {
        resolve: () => (clearTimeout(timer), resolve()),
        reject: (e: Error) => (clearTimeout(timer), reject(e)),
      };
      const timer = setTimeout(() => {
        this.readyWaiters = this.readyWaiters.filter((w) => w !== waiter); // only this waiter times out
        reject(new Error(`not loaded within ${timeoutMs / 1000} s`));
      }, timeoutMs);
      this.readyWaiters.push(waiter);
    });
  }

  private settleReady(error?: Error) {
    const waiters = this.readyWaiters;
    this.readyWaiters = [];
    for (const w of waiters) error ? w.reject(error) : w.resolve();
  }

  private fail(e: unknown) {
    this.error = errorText(e);
    this.status = 'error';
    this.settleReady(e instanceof Error ? e : new Error(this.error));
  }
}

export const editor = new EditorState();

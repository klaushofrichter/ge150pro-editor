// WebHID connection to the GE150 Pro editor interface.
import { Reassembler, toReports, type Message } from './protocol/frame';
import { Cmd, handshake, isModuleReport, renamePreset, requestCurrent, selectPreset, setModule, storePreset } from './protocol/commands';
import { decodeModule, decodePreset, PRESET_COUNT, type ExpSettings, type ModuleState, type Preset } from './protocol/preset';
import * as sys from './protocol/system';
import { decodeRhythm, RhythmCmd, type Rhythm } from './protocol/rhythm';
import { decodeExpReport, ExpCmd, setExpFunction, setExpVolume } from './protocol/exp';

export const FILTER: HIDDeviceFilter = { vendorId: 0x0483, productId: 0x5703 };
/**
 * After a host selection (`96`) the pedal switches its preset number at once but loads the preset's modules
 * 100-150 ms later (measured on V2.1.2, 2026-11-14): a `B0` in that time reports the old modules, and a module set is
 * overwritten by the load. Nothing is sent for this long after a selection.
 */
export const SELECT_SETTLE_MS = 300;

export interface DeviceEvents {
  /** Presets received so far from the dump (1-based index). */
  preset: (p: Preset) => void;
  /** The device's current preset index (selection on the pedal or confirmation of ours). */
  current: (index: number) => void;
  /** Live state of one module slot of the current preset. */
  module: (slot: number, m: ModuleState) => void;
  stored: (index: number) => void;
  system: (s: sys.SystemSettings) => void;
  systemChange: (patch: Partial<sys.SystemSettings>) => void;
  rhythm: (r: Rhythm) => void;
  /** EXP assignment of the current preset changed (at connect, or on the pedal). */
  exp: (patch: Partial<ExpSettings>) => void;
  globalEq: (eq: sys.GlobalEq) => void;
  spillOver: (on: boolean) => void;
  message: (m: Message, dir: 'in' | 'out') => void;
  disconnect: () => void;
  error: (e: Error) => void;
}

type Listener<K extends keyof DeviceEvents> = DeviceEvents[K];

export class GE150Pro {
  private rx = new Reassembler();
  private queue: Promise<void> = Promise.resolve();
  private listeners: { [K in keyof DeviceEvents]?: Listener<K>[] } = {};

  private constructor(private dev: HIDDevice) {}

  static supported(): boolean {
    return typeof navigator !== 'undefined' && 'hid' in navigator;
  }

  /** Ask the user to pick the device (must be called from a user gesture). */
  static async request(): Promise<GE150Pro | null> {
    const [dev] = await navigator.hid.requestDevice({ filters: [FILTER] });
    return dev ? new GE150Pro(dev) : null;
  }

  /** Re-open a device the user already granted. */
  static async previouslyGranted(): Promise<GE150Pro | null> {
    const devs = await navigator.hid.getDevices();
    const dev = devs.find((d) => d.vendorId === FILTER.vendorId && d.productId === FILTER.productId);
    return dev ? new GE150Pro(dev) : null;
  }

  get name() {
    return this.dev.productName;
  }

  on<K extends keyof DeviceEvents>(event: K, fn: Listener<K>) {
    ((this.listeners[event] ??= []) as Listener<K>[]).push(fn);
  }

  off<K extends keyof DeviceEvents>(event: K, fn: Listener<K>) {
    this.listeners[event] = (this.listeners[event] as Listener<K>[] | undefined)?.filter((f) => f !== fn) as never;
  }

  /**
   * Send a message and collect the device's replies until every command in `until` has arrived.
   * Resolves with the last reply per command; rejects after `timeoutMs`.
   */
  async exchange(stream: Uint8Array, until: number[], timeoutMs = 1500): Promise<Map<number, Uint8Array>> {
    const got = new Map<number, Uint8Array>();
    let done!: () => void;
    const finished = new Promise<void>((r) => (done = r));
    const listener = (m: Message, dir: 'in' | 'out') => {
      if (dir !== 'in') return;
      got.set(m.cmd, m.payload);
      if (until.every((c) => got.has(c))) done();
    };
    this.on('message', listener);
    try {
      await this.send(stream);
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`no reply ${until.filter((c) => !got.has(c)).map((c) => c.toString(16)).join(',')} within ${timeoutMs} ms`)), timeoutMs);
      });
      await Promise.race([finished, timeout]).finally(() => clearTimeout(timer));
      return got;
    } finally {
      this.off('message', listener);
    }
  }

  private emit<K extends keyof DeviceEvents>(event: K, ...args: Parameters<DeviceEvents[K]>) {
    for (const fn of (this.listeners[event] ?? []) as ((...a: unknown[]) => void)[]) fn(...args);
  }

  async open() {
    if (!this.dev.opened) await this.dev.open();
    this.dev.addEventListener('inputreport', this.onReport);
    navigator.hid.addEventListener('disconnect', this.onDisconnect);
    for (const m of handshake()) await this.send(m);
  }

  async close() {
    this.dev.removeEventListener('inputreport', this.onReport);
    navigator.hid.removeEventListener('disconnect', this.onDisconnect);
    if (this.dev.opened) await this.dev.close();
  }

  private onDisconnect = (e: HIDConnectionEvent) => {
    if (e.device === this.dev) this.emit('disconnect');
  };

  private onReport = (e: HIDInputReportEvent) => {
    const report = new Uint8Array(e.data.buffer, e.data.byteOffset, e.data.byteLength);
    let messages: Message[];
    try {
      messages = this.rx.push(report);
    } catch (err) {
      this.emit('error', err as Error);
      return;
    }
    for (const m of messages) this.dispatch(m);
  };

  private dispatch(m: Message) {
    this.emit('message', m, 'in');
    const p = m.payload;
    if (m.cmd === Cmd.PRESET_DUMP) this.emit('preset', decodePreset(p));
    else if (m.cmd === Cmd.PRESET_CHANGED || m.cmd === Cmd.STORE_ACK) {
      if (m.cmd === Cmd.STORE_ACK) this.emit('stored', p[0]);
      else this.emit('current', p[0]);
    } else if (m.cmd === Cmd.CURRENT_PRESET) this.emit('current', p[0]);
    else if (isModuleReport(m.cmd)) this.emit('module', m.cmd - Cmd.MODULE_BASE, decodeModule(p));
    else if (m.cmd === sys.SysCmd.SYSTEM) this.emit('system', sys.decodeSystem(p));
    else if (m.cmd === ExpCmd.FUNCTION || m.cmd === ExpCmd.VOLUME) {
      const patch = decodeExpReport(m.cmd, p);
      if (patch) this.emit('exp', patch);
    } else if (m.cmd === RhythmCmd.REPORT) this.emit('rhythm', decodeRhythm(p));
    else if ((sys.SYSTEM_CHANGE_CMDS as readonly number[]).includes(m.cmd)) {
      const patch = sys.decodeSystemChange(m.cmd, p);
      if (patch) this.emit('systemChange', patch);
    } else if (m.cmd === sys.SysCmd.GLOBAL_EQ || m.cmd === 0x51) this.emit('globalEq', sys.decodeGlobalEq(p));
    else if (m.cmd === sys.SysCmd.SPILL_OVER || m.cmd === 0x52) this.emit('spillOver', sys.decodeSpillOver(p));
  }

  setInputLevel(raw: number) {
    return this.send(sys.setInputLevel(raw));
  }
  setBrightness(v: number) {
    return this.send(sys.setBrightness(v));
  }
  setCabOut(left: boolean, right: boolean) {
    return this.send(sys.setCabOut(left, right));
  }
  setOtgLevel(raw: number) {
    return this.send(sys.setOtgLevel(raw));
  }
  setLanguage(lang: number) {
    return this.send(sys.setLanguage(lang));
  }
  setGlobalEq(eq: sys.GlobalEq) {
    return this.send(sys.setGlobalEq(eq));
  }
  setSpillOver(on: boolean) {
    return this.send(sys.setSpillOver(on));
  }

  /** Ask for the live state of the current preset (30, 33, 18, 02-0A). */
  requestCurrent() {
    return this.send(requestCurrent());
  }

  setExpFunction(e: ExpSettings) {
    return this.send(setExpFunction(e));
  }
  setExpVolume(e: ExpSettings) {
    return this.send(setExpVolume(e));
  }

  /** Serialize writes so multi-report messages never interleave; a selection holds the queue until the preset is loaded. */
  private send(stream: Uint8Array): Promise<void> {
    const job = this.queue.then(async () => {
      for (const r of toReports(stream)) await this.dev.sendReport(0, r);
      this.emit('message', { cmd: stream[4], payload: stream.slice(5, stream.length - 2) }, 'out');
      if (stream[4] === Cmd.SELECT_PRESET) await new Promise((r) => setTimeout(r, SELECT_SETTLE_MS));
    });
    this.queue = job.catch((e) => this.emit('error', e as Error));
    return job;
  }

  selectPreset(index: number) {
    if (index < 1 || index > PRESET_COUNT) throw new RangeError(`preset ${index}`);
    return this.send(selectPreset(index));
  }

  setModule(slot: number, m: ModuleState) {
    return this.send(setModule(slot, m));
  }

  renamePreset(index: number, name: string) {
    return this.send(renamePreset(index, name));
  }

  /** Persist a full preset to its slot on the device. */
  storePreset(p: Preset) {
    return this.send(storePreset(p));
  }

  /**
   * Write a preset into a slot the way the official editor does: select the slot, store into it (`C3` to the
   * current slot is the only store observed), and wait for the pedal's acknowledgement (`43`).
   */
  async writePreset(p: Preset, timeoutMs = 3000): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ack!: (i: number) => void;
    const acked = new Promise<void>((resolve, reject) => {
      ack = (i) => i === p.index && resolve();
      timer = setTimeout(() => reject(new Error(`the pedal did not acknowledge storing slot ${p.index}`)), timeoutMs);
    });
    this.on('stored', ack);
    try {
      await this.selectPreset(p.index);
      await this.storePreset(p);
      await acked;
    } finally {
      clearTimeout(timer);
      this.off('stored', ack);
    }
  }
}

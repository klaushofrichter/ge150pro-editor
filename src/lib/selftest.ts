// Hardware self-test: set a value, read it back from the pedal, restore, read back again.
// Uses only commands observed from the official editor. Touches live state only (nothing is
// stored) and only silent targets: a module that is switched off and EXP VOL_MIN. Read-back uses
// B0 (current preset), which the pedal answers at any time. System settings and the global EQ are
// not covered: the pedal answers their request (31) only during the connect sequence. Preset
// selection is not tested because it discards unsaved edits.
import type { GE150Pro } from './device';
import { catalog, rawRange } from './catalog';
import { errorText } from './files';
import { requestCurrent, Cmd } from './protocol/commands';
import { decodeModule, encodeModule, type ExpSettings, type ModuleState } from './protocol/preset';
import { decodeExpReport, ExpCmd } from './protocol/exp';
import { decodeRhythm, requestRhythm, RhythmCmd, styleName } from './protocol/rhythm';

export interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'skip';
  detail: string;
}

const MODULE_REPORTS = Array.from({ length: 9 }, (_, s) => Cmd.MODULE_BASE + s);
const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join(' ');
const same = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i]);

/** Live state as the pedal reports it (module reports, 18, 33). */
async function readCurrent(dev: GE150Pro) {
  const r = await dev.exchange(requestCurrent(), [...MODULE_REPORTS, ExpCmd.FUNCTION, ExpCmd.VOLUME]);
  const modules = MODULE_REPORTS.map((c) => decodeModule(r.get(c)!));
  const exp = { ...decodeExpReport(ExpCmd.FUNCTION, r.get(ExpCmd.FUNCTION)!), ...decodeExpReport(ExpCmd.VOLUME, r.get(ExpCmd.VOLUME)!) } as ExpSettings;
  return { modules, exp };
}

/** Run one set → verify → restore → verify cycle. */
async function cycle<T>(
  name: string,
  read: () => Promise<T>,
  apply: (v: T) => Promise<unknown>,
  original: T,
  changed: T,
  eq: (a: T, b: T) => boolean,
  show: (v: T) => string,
): Promise<CheckResult> {
  let restoreError = '';
  try {
    await apply(changed);
    const got = await read();
    if (!eq(got, changed)) return { name, status: 'fail', detail: `sent ${show(changed)}, pedal reports ${show(got)}` };
    return { name, status: 'pass', detail: `${show(original)} → ${show(changed)} → restored` };
  } finally {
    try {
      await apply(original);
      const back = await read();
      if (!eq(back, original)) restoreError = `restore failed: expected ${show(original)}, pedal reports ${show(back)}`;
    } catch (e) {
      restoreError = `restore failed: ${errorText(e)}`;
    }
    if (restoreError) throw new Error(`${name}: ${restoreError}`);
  }
}

export async function runSelfTest(dev: GE150Pro, onResult: (r: CheckResult) => void): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const add = (r: CheckResult) => {
    results.push(r);
    onResult(r);
  };
  const guard = async (name: string, fn: () => Promise<CheckResult>) => {
    try {
      add(await fn());
    } catch (e) {
      add({ name, status: 'fail', detail: errorText(e) });
    }
  };

  // 1. Effect module on a switched-off slot (silent).
  await guard('Effect value (off module)', async () => {
    const { modules } = await readCurrent(dev);
    const slot = modules.findIndex((m, s) => !m.on && catalog.slots[s].models[m.type]?.params.some((p) => p.kind === 'range'));
    if (slot < 0) return { name: 'Effect value (off module)', status: 'skip', detail: 'no switched-off module with a range parameter' };
    const m = modules[slot];
    const p = catalog.slots[slot].models[m.type].params.find((q) => q.kind === 'range')!;
    const [lo, hi] = rawRange(p);
    const values = [...m.values];
    values[p.pos] = values[p.pos] < hi ? values[p.pos] + 1 : Math.max(lo, values[p.pos] - 1);
    const changed: ModuleState = { ...m, values };
    return cycle(
      `Effect value (${catalog.slots[slot].name} ${p.name}, off)`,
      async () => (await readCurrent(dev)).modules[slot],
      (v) => dev.setModule(slot, v),
      m,
      changed,
      (a, b) => same(encodeModule(a), encodeModule(b)),
      (v) => String(v.values[p.pos]),
    );
  });

  // 2. EXP VOL_MIN.
  await guard('EXP VOL MIN', async () => {
    const { exp } = await readCurrent(dev);
    const changed = { ...exp, VOL_MIN: exp.VOL_MIN < 100 ? exp.VOL_MIN + 1 : exp.VOL_MIN - 1 };
    return cycle(
      'EXP VOL MIN',
      async () => (await readCurrent(dev)).exp,
      (v) => dev.setExpVolume(v),
      exp,
      changed,
      (a, b) => a.VOL_SWITCH === b.VOL_SWITCH && a.VOL_MIN === b.VOL_MIN && a.VOL_MAX === b.VOL_MAX,
      (v) => `${v.VOL_MIN}/${v.VOL_MAX}`,
    );
  });

  // 3. Rhythm state (read only).
  await guard('Rhythm report', async () => {
    const r = await dev.exchange(requestRhythm(), [RhythmCmd.REPORT]);
    const rh = decodeRhythm(r.get(RhythmCmd.REPORT)!);
    const ok = rh.bpm >= 40 && rh.bpm <= 260 && (rh.mode === 0 || rh.mode === 1);
    return { name: 'Rhythm report', status: ok ? 'pass' : 'fail', detail: `${hex(r.get(RhythmCmd.REPORT)!)} → ${rh.bpm} BPM, ${styleName(rh)}` };
  });

  return results;
}

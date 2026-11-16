// What differs between a preset and the original preset of the same name, in the terms the editor shows: module
// switches, models, parameter values and the EXP settings. Compares what sameSound compares, so a preset marked
// modified (M) always has at least one row.
import { canonical, presetName, type Layout } from './arrange';
import { catalog, formatValue, model } from './catalog';
import { expLabel } from './protocol/exp';
import type { Preset } from './protocol/preset';

export interface DiffRow {
  /** Module name (e.g. "AMP") or "EXP". */
  section: string;
  setting: string;
  original: string;
  now: string;
}

const onOff = (on: boolean) => (on ? 'on' : 'off');

export function presetDiff(original: Preset, now: Preset): DiffRow[] {
  const a = canonical(original), b = canonical(now);
  const rows: DiffRow[] = [];
  a.modules.forEach((ma, s) => {
    const mb = b.modules[s];
    const section = catalog.slots[s]?.name ?? `slot ${s + 1}`;
    if (ma.on !== mb.on) rows.push({ section, setting: 'Switch', original: onOff(ma.on), now: onOff(mb.on) });
    const md = model(s, ma.type);
    if (ma.type !== mb.type) {
      rows.push({ section, setting: 'Model', original: md?.name ?? `#${ma.type + 1}`, now: model(s, mb.type)?.name ?? `#${mb.type + 1}` });
      return; // another model has other parameters: the model row says it
    }
    if (md) {
      for (const p of md.params) {
        const x = ma.values[p.pos], y = mb.values[p.pos];
        if (x !== y) rows.push({ section, setting: p.name, original: formatValue(p, x), now: formatValue(p, y) });
      }
    } else {
      ma.values.forEach((x, k) => {
        if (x !== mb.values[k]) rows.push({ section, setting: `value ${k + 1}`, original: String(x), now: String(mb.values[k]) });
      });
    }
  });
  const ea = a.exp, eb = b.exp;
  const exp = (setting: string, original: string, now: string) => original !== now && rows.push({ section: 'EXP', setting, original, now });
  exp('Pedal moves', expLabel(ea), expLabel(eb));
  exp('Starts in', ea.FUN_SWITCH ? 'EXP mode' : 'volume mode', eb.FUN_SWITCH ? 'EXP mode' : 'volume mode');
  exp('Volume mode', onOff(!!ea.VOL_SWITCH), onOff(!!eb.VOL_SWITCH));
  exp('Volume MIN', String(ea.VOL_MIN), String(eb.VOL_MIN));
  exp('Volume MAX', String(ea.VOL_MAX), String(eb.VOL_MAX));
  return rows;
}

/** The original preset of the same name: the one in the same slot if there is one, else the first. */
export function originalFor(p: Preset, original: Layout | null): Preset | null {
  const name = presetName(p);
  const same = (original ?? []).filter((o): o is Preset => !!o && presetName(o) === name);
  return same.find((o) => o.index === p.index) ?? same[0] ?? null;
}

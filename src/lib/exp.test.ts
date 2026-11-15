import { describe, expect, it } from 'vitest';
import { expTarget, model } from './catalog';
import { withoutPedalMove } from './exp';
import { demoPresets } from './demo';
import type { Preset } from './protocol/preset';

// The recorded case (2026-11-14): EXP on DS GAIN (MODULE_CTRL 1, PARA_CTRL 12), DS model 14.
const DS = 1;
const base = (): Preset => {
  const p = structuredClone(demoPresets()[0]);
  p.modules[DS] = { on: true, type: 14, values: [27, 30, 35, 0, 0, 0, 0, 0, 0, 0] };
  p.exp = { ...p.exp, MODULE_CTRL: DS, PARA_CTRL: 12, FUN_SWITCH: 1 };
  return p;
};
const withDs = (p: Preset, values: number[]): Preset => ({ ...p, modules: p.modules.with(DS, { ...p.modules[DS], values }) });

describe('expression pedal', () => {
  it('finds the parameter the pedal moves in the current model', () => {
    const t = expTarget(base().exp, base().modules)!;
    expect(t.slot).toBe(DS);
    expect(t.name).toBe('GAIN');
    expect(t.spec?.pos).toBe(model(DS, 14)!.params.find((p) => p.name.toUpperCase() === 'GAIN')!.pos);
  });

  it('matches catalog spellings that differ from the EXP names (FEEDBACK is F.BACK)', () => {
    const slot = 6; // MOD; F.BACK is id 46, and FLANGER PRO (type 21) spells it FEEDBACK
    const modules = base().modules.with(slot, { on: true, type: 21, values: Array(10).fill(0) });
    expect(expTarget({ MODULE_CTRL: slot, PARA_CTRL: 46 }, modules)?.spec).toBeDefined();
  });

  it('has no parameter when the model lacks it, and no target for unknown ids', () => {
    expect(expTarget({ MODULE_CTRL: DS, PARA_CTRL: 99 }, base().modules)).toBeNull();
    expect(expTarget({ MODULE_CTRL: 12, PARA_CTRL: 0 }, base().modules)).toBeNull();
  });

  it('keeps the stored value of the parameter the pedal moved', () => {
    const stored = base();
    const played = withDs(stored, [27, 30, 100, 0, 0, 0, 0, 0, 0, 0]);
    expect(withoutPedalMove(played, stored).modules[DS].values).toEqual(stored.modules[DS].values);
  });

  it('keeps other edits of the same module', () => {
    const stored = base();
    const edited = withDs(stored, [40, 30, 100, 0, 0, 0, 0, 0, 0, 0]);
    expect(withoutPedalMove(edited, stored).modules[DS].values).toEqual([40, 30, 35, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('returns the same object when nothing was moved, and the live state after a model change', () => {
    const stored = base();
    const same = structuredClone(stored);
    expect(withoutPedalMove(same, stored)).toBe(same);
    const other = { ...stored, modules: stored.modules.with(DS, { ...stored.modules[DS], type: 3 }) };
    expect(withoutPedalMove(other, stored)).toBe(other);
    expect(withoutPedalMove(same, undefined)).toBe(same);
  });
});

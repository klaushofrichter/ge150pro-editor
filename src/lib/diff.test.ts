import { describe, expect, it } from 'vitest';
import { atSlot, sameSound } from './arrange';
import { catalog } from './catalog';
import { originalFor, presetDiff } from './diff';
import type { Preset } from './protocol/preset';

const preset = (name: string, index = 1): Preset => ({
  index,
  name,
  modules: Array.from({ length: 9 }, (_, s) => ({ on: s % 2 === 0, type: 0, values: [50, 50, 50, 50, 50, 50, 50, 50, 50, 50] })),
  exp: { MODULE_CTRL: 8, PARA_CTRL: 57, FUN_SWITCH: 1, VOL_SWITCH: 1, VOL_MIN: 0, VOL_MAX: 100 },
});
const amp = catalog.slots[2];

describe('differences from the original', () => {
  it('is empty for the same sound, and lists every changed setting with display values', () => {
    const o = preset('A');
    expect(presetDiff(o, structuredClone(o))).toEqual([]);
    const p = structuredClone(o);
    p.modules[2].values[amp.models[0].params[0].pos] = 20;
    p.modules[1].on = !p.modules[1].on;
    p.exp.VOL_MAX = 80;
    p.exp.FUN_SWITCH = 0;
    const rows = presetDiff(o, p);
    expect(rows).toContainEqual({ section: amp.name, setting: amp.models[0].params[0].name, original: expect.any(String), now: expect.stringContaining('20') });
    expect(rows).toContainEqual({ section: catalog.slots[1].name, setting: 'Switch', original: 'off', now: 'on' });
    expect(rows).toContainEqual({ section: 'EXP', setting: 'Volume MAX', original: '100', now: '80' });
    expect(rows).toContainEqual({ section: 'EXP', setting: 'Starts in', original: 'EXP mode', now: 'volume mode' });
    expect(sameSound(o, p)).toBe(false);
  });

  it('shows a model change as one row, not the other model parameters', () => {
    const o = preset('A');
    const p = structuredClone(o);
    p.modules[2].type = 1;
    expect(presetDiff(o, p)).toEqual([{ section: amp.name, setting: 'Model', original: amp.models[0].name, now: amp.models[1].name }]);
  });

  it('ignores values the model does not use, as the M mark does', () => {
    const o = preset('A');
    const p = structuredClone(o);
    const used = new Set(amp.models[0].params.map((x) => x.pos));
    const unused = [...Array(10).keys()].find((k) => !used.has(k))!;
    p.modules[2].values[unused] = 1;
    expect(sameSound(o, p)).toBe(true);
    expect(presetDiff(o, p)).toEqual([]);
  });

  it('finds the original of the same name, preferring the same slot', () => {
    const original = [atSlot(preset('A'), 1), atSlot(preset('B'), 2), atSlot(preset('A'), 3)];
    expect(originalFor(atSlot(preset('A'), 3), original)?.index).toBe(3);
    expect(originalFor(atSlot(preset('A'), 9), original)?.index).toBe(1);
    expect(originalFor(preset('C'), original)).toBeNull();
    expect(originalFor(preset('A'), null)).toBeNull();
  });
});

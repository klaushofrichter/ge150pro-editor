import { describe, expect, it } from 'vitest';
import {
  atSlot, backupFileName, canonical, moSet, parseManifest, placeByManifest, changedSlots, copyAs, copyName, emptyPreset, layoutToMoFiles, originsFrom, placeFromTray, slotOfFile, fileToLayout, isComplete, layoutToFile, placeByName, samePreset, swapBanks, swapSlots,
  type Layout,
} from './arrange';
import { presetToMo } from './protocol/mo';
import { encodePreset, PRESET_COUNT, type Preset } from './protocol/preset';

const preset = (name: string, gain = 50): Preset => ({
  index: 1,
  name,
  modules: Array.from({ length: 9 }, (_, s) => ({ on: s % 2 === 0, type: 0, values: [gain, 0, 0, 0, 0, 0, 0, 0, 0, 0] })),
  exp: { MODULE_CTRL: 8, PARA_CTRL: 57, FUN_SWITCH: 1, VOL_SWITCH: 1, VOL_MIN: 0, VOL_MAX: 100 },
});
const full = (): Layout => Array.from({ length: PRESET_COUNT }, (_, i) => atSlot(preset(`P${i + 1}`), i + 1));
const names = (l: Layout) => l.map((p) => p?.name ?? null);

describe('arranging', () => {
  it('swaps two slots without losing either preset', () => {
    const l = swapSlots(full(), 0, 199);
    expect(l[0]!.name).toBe('P200');
    expect(l[199]!.name).toBe('P1');
    expect(new Set(names(l)).size).toBe(PRESET_COUNT);
  });

  it('swaps whole banks and keeps A-D order', () => {
    const l = swapBanks(full(), 0, 49);
    expect(names(l).slice(0, 4)).toEqual(['P197', 'P198', 'P199', 'P200']);
    expect(names(l).slice(196)).toEqual(['P1', 'P2', 'P3', 'P4']);
  });

  it('compares content, not the slot a preset came from', () => {
    expect(samePreset(atSlot(preset('A'), 3), atSlot(preset('A'), 9))).toBe(true);
    expect(samePreset(preset('A'), preset('A', 51))).toBe(false);
    expect(samePreset(preset('A'), preset('B'))).toBe(false);
  });

  it('lists only the slots whose preset changes, and ignores unfilled ones', () => {
    const pedal = full();
    const target = swapSlots(pedal, 0, 1);
    target[10] = null;
    expect(changedSlots(pedal, target)).toEqual([1, 2]);
    // moving the last into the first place and shifting the rest changes every slot
    const shifted = [pedal[199], ...pedal.slice(0, 199)];
    expect(changedSlots(pedal, shifted)).toHaveLength(PRESET_COUNT);
  });
});

describe('compared with the original', () => {
  const original = full();
  it('is original when name and sound match, in any slot', () => {
    expect(originsFrom(original)(atSlot(original[7]!, 100))).toBe('original');
  });
  it('is modified when the name is known but the sound differs', () => {
    const p = atSlot(original[7]!, 8);
    p.modules[0] = { ...p.modules[0], values: [99, ...p.modules[0].values.slice(1)] };
    expect(originsFrom(original)(p)).toBe('modified');
  });
  it('ignores values the model does not use (lost in .mo files, set by the pedal)', () => {
    const p = atSlot(original[7]!, 8);
    p.modules[8] = { ...p.modules[8], values: p.modules[8].values.map((v, k) => (k === 9 ? 65 : v)) };
    expect(originsFrom(original)(p)).toBe('original');
  });
  it('is new when the original has no such name, a renamed original included', () => {
    expect(originsFrom(original)({ ...original[7]!, name: 'My Tone' })).toBe('new');
  });
});

describe('as the pedal stores it', () => {
  it('corrects an EXP parameter of another module and an unknown model, and compares that way', () => {
    const p = preset('X');
    p.exp = { ...p.exp, MODULE_CTRL: 2, PARA_CTRL: 5 }; // AMP has 13-18
    p.modules[1] = { ...p.modules[1], type: 54 }; // DS has 28 models
    const c = canonical(p);
    expect(c.exp.PARA_CTRL).toBe(13);
    expect(c.modules[1].type).toBe(0);
    expect(canonical({ ...p, exp: { ...p.exp, MODULE_CTRL: 1, PARA_CTRL: 2 } }).exp.PARA_CTRL).toBe(10);
    expect(samePreset(p, c)).toBe(true);
    expect(canonical(preset('Y'))).toEqual(preset('Y'));
  });
});

describe('empty slots and copies', () => {
  it('an empty slot is the pedal\'s own "Empty" preset, byte for byte', () => {
    const e = emptyPreset(30);
    const body = encodePreset(e);
    expect(body[0]).toBe(30);
    expect(String.fromCharCode(...body.subarray(1, 17))).toBe('Empty           ');
    expect(e.modules.every((m) => !m.on && m.type === 0)).toBe(true);
    expect(originsFrom(full())(e)).toBe('empty');
    expect(originsFrom(full())({ ...e, name: 'Empty' })).toBe('empty');
  });

  it('a copy has a free name and counts as new', () => {
    const l = full();
    l[5] = { ...l[5]!, name: 'P1 2' };
    expect(copyName(l[0]!, l)).toBe('P1 3');
    const long = { ...l[0]!, name: 'Sixteen chars 16' };
    expect(copyName(long, l)).toBe('Sixteen chars 2');
    const c = copyAs(l[0]!, 'My Tone', 99);
    expect(c.index).toBe(99);
    expect(c.modules).toEqual(l[0]!.modules);
    expect(originsFrom(full())(c)).toBe('new');
  });
});

describe('placing .mo files by name', () => {
  const file = (name: string, gain = 50) => ({ file: `${name}.mo`, mo: presetToMo(preset(name.padEnd(16, ' '), gain)) });

  it('fills slots by name, a name shown twice in both slots, the rest unplaced', () => {
    const reference = Array.from({ length: PRESET_COUNT }, (_, i) => `P${i + 1}`);
    reference[7] = 'P1'; // a name the reference shows twice
    const files = [file('P1'), file('P2'), file('Orphan')];
    const { layout, unplaced } = placeByName(files, reference);
    expect(layout[0]!.name.trim()).toBe('P1');
    expect(layout[7]!.name.trim()).toBe('P1');
    expect(layout[1]!.name.trim()).toBe('P2');
    expect(layout[2]).toBeNull();
    expect(unplaced.map((u) => u.file)).toEqual(['Orphan.mo']);
    expect(isComplete(layout)).toBe(false);
  });
});

describe('the tray', () => {
  it('puts a waiting preset into a slot and moves the one it replaces to the tray', () => {
    const l = full();
    const tray = [{ file: 'a.mo', preset: preset('Waiting') }];
    const got = placeFromTray(l, tray, 0, 9);
    expect(got.layout[9]!.name).toBe('Waiting');
    expect(got.layout[9]!.index).toBe(10);
    expect(got.tray).toEqual([{ file: 'from 3B', preset: l[9] }]);
    const empty = [...l];
    empty[9] = null;
    expect(placeFromTray(empty, tray, 0, 9).tray).toEqual([]);
  });

  it('the M and N marks without an original: only empty slots are told apart', () => {
    expect(originsFrom(null)(full()[0])).toBeNull();
    expect(originsFrom(null)(emptyPreset(3))).toBe('empty');
    expect(originsFrom(null)(null)).toBeNull();
  });
});

describe('.mo file sets', () => {
  it('name each file by its slot, so a folder sorts and imports in slot order', () => {
    const l = full();
    l[0] = { ...l[0]!, name: 'AC/DC: Live?' };
    const files = layoutToMoFiles(l);
    expect(files).toHaveLength(PRESET_COUNT);
    expect(files[0].filename).toBe('01A AC_DC_ Live_.mo');
    expect(files[199].filename).toBe('50D P200.mo');
    expect(slotOfFile(files[199].filename)).toBe(200);
    expect(slotOfFile('Brit 800 Drive.mo')).toBeNull();
  });

  it('import back into the same slots, whatever the names', () => {
    const l = full();
    l[3] = { ...l[3]!, name: 'P1' }; // a duplicate name stays in its own slot
    const files = layoutToMoFiles(l).map((f) => ({ file: f.filename, mo: JSON.parse(f.json) }));
    const { layout, unplaced } = placeByName(files.reverse(), []);
    expect(unplaced).toEqual([]);
    l.forEach((p, i) => expect(layout[i]!.name).toBe(p!.name));
  });
});

describe('preset sets with a manifest', () => {
  it('describe the set and every file, and import back by the manifest', async () => {
    const l = full();
    const files = await moSet(l, { name: 'Factory', kind: 'original', immutable: true, description: 'test', source: { type: 'firmware', version: 'V2.1.2' } }, '2026-11-14T10:00:00Z');
    expect(files).toHaveLength(PRESET_COUNT + 1);
    const m = parseManifest(files.at(-1)!.json);
    expect(m).toMatchObject({ kind: 'original', immutable: true, created: '2026-11-14T10:00:00Z', source: { version: 'V2.1.2' } });
    expect(m.presets[0]).toMatchObject({ slot: '01A', file: '01A P1.mo', name: 'P1' });
    const folder = new Map(files.map((f) => [f.filename, f.json]));
    let got = await placeByManifest(m, folder);
    expect(got.changed).toEqual([]);
    l.forEach((p, i) => expect(samePreset(got.layout[i], p)).toBe(true));
    // a changed and a missing file are reported
    folder.set('01A P1.mo', folder.get('01A P1.mo')!.replace('"SWITCH": 1', '"SWITCH": 0'));
    folder.delete('50D P200.mo');
    got = await placeByManifest(m, folder);
    expect(got.changed).toEqual(['01A P1.mo']);
    expect(got.missing).toEqual(['50D P200.mo']);
  });
});

describe('what counts as a change', () => {
  it('values the pedal corrects when storing are not a change (an EXP parameter of another module, an unknown model)', () => {
    const pedal = full();
    const target = [...pedal];
    const p = atSlot(pedal[3]!, 4);
    p.exp = { ...p.exp, MODULE_CTRL: 2, PARA_CTRL: 13 }; // as the pedal stores it
    pedal[3] = p;
    target[3] = { ...p, exp: { ...p.exp, PARA_CTRL: 5 } }; // 5 is not an AMP parameter: the pedal makes it 13
    expect(changedSlots(pedal, target)).toEqual([]);
    target[3] = { ...p, exp: { ...p.exp, PARA_CTRL: 14 } }; // another AMP parameter: a real change
    expect(changedSlots(pedal, target)).toEqual([4]);
  });
});

describe('backup files', () => {
  it('read a whole-device backup, which carries system settings besides the presets', () => {
    const file = { ...layoutToFile(full(), 'Pedal and system settings'), system: { brightness: 10 }, globalEq: null, spillOver: true };
    const { layout, name } = fileToLayout(JSON.parse(JSON.stringify(file)));
    expect(name).toBe('Pedal and system settings');
    expect(isComplete(layout)).toBe(true);
  });

  it('are named with the second, and with characters file systems refuse replaced', () => {
    expect(backupFileName('My: set/1\n', '2026-11-14T10:15:42.123Z')).toBe('GE150PRO My_ set_1_ 2026-11-14-10-15-42.json');
  });

  it('round-trip a layout, including unfilled slots', () => {
    const l = full();
    l[3] = null;
    const back = fileToLayout(JSON.parse(JSON.stringify(layoutToFile(l, 'test'))));
    expect(back.name).toBe('test');
    expect(back.layout[3]).toBeNull();
    l.forEach((p, i) => p && expect(samePreset(back.layout[i], p)).toBe(true));
    expect(back.layout[199]!.index).toBe(200);
  });

  it('refuse other files', () => {
    expect(() => fileToLayout({ format: 'x' })).toThrow(/not a GE150 Pro backup/);
    expect(() => fileToLayout({ format: 'ge150pro-web-backup', version: 1, presets: [{ index: 201, mo: {} }] })).toThrow(/out of range/);
  });
});


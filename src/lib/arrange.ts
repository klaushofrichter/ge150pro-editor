// Preset arrangement and backups: which preset sits in which of the 200 slots, as plain data.
// A layout is 200 entries, slot 1 at position 0; an entry is the preset meant for that slot (its own `index` is
// ignored until it is written) or null while a slot is still unfilled.
import { model } from './catalog';
import { sha256Hex } from './firmware';
import { EXP_PARAMS } from './protocol/exp';
import { moToPreset, presetToMo, type MoFile } from './protocol/mo';
import { encodePreset, PRESET_COUNT, type Preset } from './protocol/preset';

export type Layout = (Preset | null)[];

export const BANK_SIZE = 4;
export const BANK_COUNT = PRESET_COUNT / BANK_SIZE;

/** The preset as it would be written to slot `index`. */
export const atSlot = (p: Preset, index: number): Preset => ({ ...(JSON.parse(JSON.stringify(p)) as Preset), index });

/**
 * The preset as the pedal stores it. The pedal corrects two kinds of values when it stores a preset (observed
 * 2026-11-14 writing the factory set, 11 of 29 presets): an EXP parameter id that is not one of the controlled
 * module's (EXP_PARAMS) becomes that module's first id, and a model number the slot does not have becomes 0.
 */
export function canonical(p: Preset): Preset {
  const ids = EXP_PARAMS[p.exp.MODULE_CTRL]?.map((x) => x.id);
  const exp = ids && !ids.includes(p.exp.PARA_CTRL) ? { ...p.exp, PARA_CTRL: ids[0] } : p.exp;
  const modules = p.modules.map((m, s) => (model(s, m.type) ? m : { ...m, type: 0 }));
  return { ...p, modules, exp };
}

/** Same content (name, modules, EXP) as the pedal would store it, regardless of the slot it came from. */
export function samePreset(a: Preset | null | undefined, b: Preset | null | undefined): boolean {
  if (!a || !b) return a === b;
  const x = encodePreset({ ...canonical(a), index: 1 });
  const y = encodePreset({ ...canonical(b), index: 1 });
  return x.every((v, i) => v === y[i]);
}

// ---- compared with the original --------------------------------------------------------------------------------

export const presetName = (p: Preset) => p.name.replace(/\0+$/, '').trim();

/**
 * Same sound: each module's switch and model, the values its model uses, and the EXP settings. Values a model does
 * not use are ignored: .mo files do not carry them, and the pedal sets some itself (REVERB v4 outside SHIMMER).
 */
export function sameSound(x: Preset, y: Preset): boolean {
  const a = canonical(x), b = canonical(y);
  const ma = a.modules, mb = b.modules;
  for (let s = 0; s < ma.length; s++) {
    if (ma[s].on !== mb[s].on || ma[s].type !== mb[s].type) return false;
    const used = model(s, ma[s].type)?.params.map((p) => p.pos) ?? ma[s].values.map((_, k) => k);
    if (used.some((k) => ma[s].values[k] !== mb[s].values[k])) return false;
  }
  return (Object.keys(a.exp) as (keyof Preset['exp'])[]).every((k) => a.exp[k] === b.exp[k]);
}

// ---- empty slots and copies -------------------------------------------------------------------------------------

/**
 * What the pedal holds in an unused slot: named "Empty", every module off. These values are those of the pedal's own
 * "Empty" slots (8B, 8D, 9D, 10B on the test unit, 2026-11-14), byte for byte.
 */
const EMPTY: Omit<Preset, 'index'> = {
  name: 'Empty'.padEnd(16, ' '),
  modules: [
    [50, 50, 50, 50, 0, 0, 0, 0, 0, 0],
    [50, 50, 50, 0, 0, 0, 0, 0, 0, 0],
    [50, 50, 50, 50, 50, 50, 0, 0, 0, 0],
    [0, 1, 20, 0, 0, 0, 0, 0, 0, 0],
    [20, 20, 20, 0, 0, 0, 0, 0, 0, 0],
    [16, 16, 16, 16, 16, 16, 100, 600, 1250, 0],
    [50, 50, 50, 50, 50, 50, 50, 0, 0, 0],
    [20, 20, 600, 1, 831, 1, 0, 0, 0, 0],
    [80, 25, 40, 40, 0, 0, 0, 0, 0, 0],
  ].map((values) => ({ on: false, type: 0, values })),
  exp: { MODULE_CTRL: 0, PARA_CTRL: 1, FUN_SWITCH: 0, VOL_SWITCH: 0, VOL_MIN: 0, VOL_MAX: 100 },
};

export const emptyPreset = (index: number): Preset => atSlot({ ...EMPTY, index }, index);

/** Named "Empty" with every module off: an unused slot (whatever the other values are). */
export const isEmptyPreset = (p: Preset) => presetName(p) === 'Empty' && p.modules.every((m) => !m.on);

/** A copy of a preset under another name, for another slot. */
export function copyAs(p: Preset, name: string, index: number): Preset {
  return { ...atSlot(p, index), name: name.slice(0, 16) };
}

/** "Name 2", "Name 3", … within 16 characters, not yet used in the layout. */
export function copyName(p: Preset, layout: Layout): string {
  const base = presetName(p);
  const used = new Set(layout.filter(Boolean).map((x) => presetName(x!)));
  for (let n = 2; ; n++) {
    const suffix = ` ${n}`;
    const name = base.slice(0, 16 - suffix.length).trimEnd() + suffix;
    if (!used.has(name)) return name;
  }
}

export type Origin = 'original' | 'modified' | 'new' | 'empty';

/**
 * How a preset relates to the original set, by name only: a name the original does not have is new (a renamed
 * original included); a known name with another sound is modified.
 */
export function originOf(p: Preset, original: Layout): Origin {
  if (isEmptyPreset(p)) return 'empty';
  const name = presetName(p);
  const same = original.filter((o): o is Preset => !!o && presetName(o) === name);
  if (!same.length) return 'new';
  return same.some((o) => sameSound(o, p)) ? 'original' : 'modified';
}

/** Exchange two slots (0-based positions). Nothing is lost: each preset ends up in the other's place. */
export function swapSlots(layout: Layout, a: number, b: number): Layout {
  const next = [...layout];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}

/** Exchange two whole banks (0-based bank numbers), keeping the A-D order inside each. */
export function swapBanks(layout: Layout, a: number, b: number): Layout {
  let next = layout;
  for (let k = 0; k < BANK_SIZE; k++) next = swapSlots(next, a * BANK_SIZE + k, b * BANK_SIZE + k);
  return next;
}

/** 1-based slots whose preset in `target` differs from what the pedal holds now. Unfilled target slots are left alone. */
export function changedSlots(pedal: (Preset | undefined | null)[], target: Layout): number[] {
  const out: number[] = [];
  target.forEach((p, i) => {
    if (p && !samePreset(p, pedal[i])) out.push(i + 1);
  });
  return out;
}

const cleanName = (s: string) => s.replace(/\0+$/, '').trim();

/** "01A " at the start of a file name: the slot it was exported from (see layoutToMoFiles). */
export function slotOfFile(file: string): number | null {
  const m = /^(\d{2})([A-D]) /.exec(file);
  if (!m) return null;
  const slot = (Number(m[1]) - 1) * BANK_SIZE + 'ABCD'.indexOf(m[2]) + 1;
  return slot >= 1 && slot <= PRESET_COUNT ? slot : null;
}

/** One .mo file per filled slot, named "01A Name.mo" so a folder sorts, and imports, in slot order. */
export function layoutToMoFiles(layout: Layout): { filename: string; json: string }[] {
  const out: { filename: string; json: string }[] = [];
  layout.forEach((p, i) => {
    if (!p) return;
    const safe = presetName(p).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_') || 'preset';
    const label = `${String(Math.floor(i / BANK_SIZE) + 1).padStart(2, '0')}${'ABCD'[i % BANK_SIZE]}`;
    out.push({ filename: `${label} ${safe}.mo`, json: JSON.stringify(presetToMo(atSlot(p, i + 1)), null, 4) });
  });
  return out;
}

// ---- preset sets with a manifest -------------------------------------------------------------------------------

export const MANIFEST_FILE = 'manifest.json';
export const MANIFEST_FORMAT = 'ge150pro-preset-set';

/** Describes a folder of .mo files: what the set is, where it came from, and which file belongs in which slot. */
export interface SetManifest {
  format: typeof MANIFEST_FORMAT;
  version: 1;
  name: string;
  /** "original": the factory set, never to be changed; "backup": a copy of the pedal or an arrangement. */
  kind: 'original' | 'backup';
  immutable: boolean;
  description: string;
  /** When this folder was written. */
  created: string;
  /** Where the presets came from, e.g. { type: "firmware", version, sha256 } or { type: "pedal", taken }. */
  source: Record<string, string>;
  presets: { slot: string; file: string; name: string; sha256: string }[];
}

const encoder = new TextEncoder();

/** The .mo files of a layout plus manifest.json describing the set. */
export async function moSet(
  layout: Layout,
  info: Pick<SetManifest, 'name' | 'kind' | 'immutable' | 'description' | 'source'>,
  created = new Date().toISOString(),
): Promise<{ filename: string; json: string }[]> {
  const files = layoutToMoFiles(layout);
  const presets = [];
  for (const f of files) {
    const slot = f.filename.slice(0, 3);
    const p = layout[slotOfFile(f.filename)! - 1]!;
    presets.push({ slot, file: f.filename, name: presetName(p), sha256: await sha256Hex(encoder.encode(f.json)) });
  }
  const manifest: SetManifest = { format: MANIFEST_FORMAT, version: 1, ...info, created, presets };
  return [...files, { filename: MANIFEST_FILE, json: JSON.stringify(manifest, null, 2) + '\n' }];
}

export function parseManifest(text: string): SetManifest {
  const m = JSON.parse(text) as SetManifest;
  if (m?.format !== MANIFEST_FORMAT || m.version !== 1 || !Array.isArray(m.presets)) throw new Error('not a GE150 Pro preset set manifest');
  return m;
}

/**
 * Place a folder's files by its manifest. Files whose content no longer matches the manifest's checksum, and files
 * the manifest lists but the folder lacks, are reported; changed files are still placed.
 */
export async function placeByManifest(
  manifest: SetManifest,
  files: Map<string, string>,
): Promise<{ layout: Layout; changed: string[]; missing: string[] }> {
  const layout: Layout = Array(PRESET_COUNT).fill(null);
  const changed: string[] = [];
  const missing: string[] = [];
  for (const e of manifest.presets) {
    const text = files.get(e.file);
    const slot = slotOfFile(`${e.slot} `);
    if (text === undefined || !slot) {
      missing.push(e.file);
      continue;
    }
    if ((await sha256Hex(encoder.encode(text))) !== e.sha256) changed.push(e.file);
    layout[slot - 1] = moToPreset(JSON.parse(text) as MoFile, slot);
  }
  return { layout, changed, missing };
}

/**
 * Place .mo files into slots: a file named "01A …" goes to that slot; any other file goes where the pedal (`reference`, its current names) has a preset of the same name.
 * A name the pedal shows in several slots fills all of them. `hints` places known originals by slot (1-based) where
 * the pedal's name has changed since. Files no slot takes are returned as `unplaced`.
 */
export function placeByName(
  files: { file: string; mo: MoFile }[],
  reference: (string | undefined)[],
  hints: Record<number, string> = {},
): { layout: Layout; unplaced: { file: string; preset: Preset }[] } {
  const layout: Layout = Array(PRESET_COUNT).fill(null);
  const bySlot = new Set<number>();
  const rest: typeof files = [];
  for (const f of files) {
    const slot = slotOfFile(f.file);
    if (slot && !bySlot.has(slot)) {
      layout[slot - 1] = moToPreset(f.mo, slot);
      bySlot.add(slot);
    } else rest.push(f);
  }
  const byName = new Map<string, { file: string; preset: Preset }>();
  for (const f of rest) byName.set(cleanName(f.mo.fileInfo?.preset_name ?? f.file), { file: f.file, preset: moToPreset(f.mo, 1) });
  const used = new Set<string>();
  Array.from({ length: PRESET_COUNT }, (_, i) => {
    if (bySlot.has(i + 1)) return;
    const name = hints[i + 1] ?? cleanName(reference[i] ?? '');
    const hit = byName.get(name);
    if (!hit) return;
    used.add(name);
    layout[i] = atSlot(hit.preset, i + 1);
  });
  const unplaced = [...byName.entries()].filter(([n]) => !used.has(n)).map(([, v]) => v);
  return { layout, unplaced };
}

// ---- backup files ----------------------------------------------------------------------------------------------
// The format of the editor's whole-device export: every preset in .mo form, by slot.

export const BACKUP_FORMAT = 'ge150pro-web-backup';

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: 1;
  created: string;
  name?: string;
  presets: ({ index: number; mo: MoFile } | null)[];
  [extra: string]: unknown;
}

export function layoutToFile(layout: Layout, name: string, created = new Date().toISOString()): BackupFile {
  return {
    format: BACKUP_FORMAT,
    version: 1,
    created,
    name,
    presets: layout.map((p, i) => (p ? { index: i + 1, mo: presetToMo(atSlot(p, i + 1)) } : null)),
  };
}

export function fileToLayout(data: unknown): { layout: Layout; name: string; created: string } {
  const f = data as Partial<BackupFile>;
  if (f?.format !== BACKUP_FORMAT || f.version !== 1 || !Array.isArray(f.presets)) throw new Error('not a GE150 Pro backup file');
  const layout: Layout = Array(PRESET_COUNT).fill(null);
  for (const e of f.presets) {
    if (!e) continue;
    if (!Number.isInteger(e.index) || e.index < 1 || e.index > PRESET_COUNT) throw new Error(`preset slot ${e.index} out of range`);
    layout[e.index - 1] = moToPreset(e.mo, e.index);
  }
  return { layout, name: f.name ?? '', created: f.created ?? '' };
}

export const isComplete = (layout: Layout) => layout.length === PRESET_COUNT && layout.every(Boolean);

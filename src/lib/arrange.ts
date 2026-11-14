// Preset arrangement and backups: which preset sits in which of the 200 slots, as plain data.
// A layout is 200 entries, slot 1 at position 0; an entry is the preset meant for that slot (its own `index` is
// ignored until it is written) or null while a slot is still unfilled.
import { model } from './catalog';
import { sha256Hex } from './firmware';
import { EXP_PARAMS } from './protocol/exp';
import { moToPreset, presetToMo, type MoFile } from './protocol/mo';
import { encodePreset, NAME_LENGTH, paddedLabel, PRESET_COUNT, presetLabel, type Preset } from './protocol/preset';

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

/**
 * The bytes a preset compares by: as the pedal would store it, in no particular slot. Cached per preset object, so
 * comparing a layout with the pedal after an edit encodes only the presets that changed. This relies on presets being
 * values: every change makes a new object (the Arrange dialog keeps plain, unproxied layouts; the store replaces
 * presets instead of changing them in place).
 */
const compareBytes = new WeakMap<Preset, Uint8Array>();
function bytesOf(p: Preset): Uint8Array {
  let b = compareBytes.get(p);
  if (!b) compareBytes.set(p, (b = encodePreset({ ...canonical(p), index: 1 })));
  return b;
}

/** Same content (name, modules, EXP) as the pedal would store it, regardless of the slot it came from. */
export function samePreset(a: Preset | null | undefined, b: Preset | null | undefined): boolean {
  if (!a || !b) return a === b;
  if (a === b) return true;
  const x = bytesOf(a);
  const y = bytesOf(b);
  return x.every((v, i) => v === y[i]);
}

// ---- compared with the original --------------------------------------------------------------------------------

/** A name as shown and compared: without the padding (NULs, spaces) of the 16 stored bytes. */
export const trimName = (s: string) => s.replace(/\0+$/, '').trim();
export const presetName = (p: Preset) => trimName(p.name);

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
  name: 'Empty'.padEnd(NAME_LENGTH, ' '),
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
  return { ...atSlot(p, index), name: name.slice(0, NAME_LENGTH) };
}

/** "Name 2", "Name 3", … within 16 characters, not yet used in the layout. */
export function copyName(p: Preset, layout: Layout): string {
  const base = presetName(p);
  const used = new Set(layout.filter(Boolean).map((x) => presetName(x!)));
  for (let n = 2; ; n++) {
    const suffix = ` ${n}`;
    const name = base.slice(0, NAME_LENGTH - suffix.length).trimEnd() + suffix;
    if (!used.has(name)) return name;
  }
}

export type Origin = 'original' | 'modified' | 'new' | 'empty';

/**
 * How presets relate to the original set, by name only: a name the original does not have is new (a renamed
 * original included); a known name with another sound is modified. Without an original only empty slots are told
 * apart (null otherwise). The names are indexed once per original.
 */
export function originsFrom(original: Layout | null): (p: Preset | null | undefined) => Origin | null {
  const byName = new Map<string, Preset[]>();
  for (const o of original ?? []) {
    if (!o) continue;
    const name = presetName(o);
    const list = byName.get(name);
    if (list) list.push(o);
    else byName.set(name, [o]);
  }
  const memo = new WeakMap<Preset, Origin | null>(); // presets are values (see samePreset)
  const origin = (p: Preset): Origin | null => {
    if (isEmptyPreset(p)) return 'empty';
    if (!original) return null;
    const same = byName.get(presetName(p));
    if (!same) return 'new';
    return same.some((o) => sameSound(o, p)) ? 'original' : 'modified';
  };
  return (p) => {
    if (!p) return null;
    if (!memo.has(p)) memo.set(p, origin(p));
    return memo.get(p)!;
  };
}

/** A preset waiting for a slot, and the file (or slot) it came from. */
export type TrayItem = { file: string; preset: Preset };

/** Put a waiting preset (from the tray) into a slot; the preset it replaces goes to the tray, so nothing is lost. */
export function placeFromTray(layout: Layout, tray: TrayItem[], item: number, slot: number): { layout: Layout; tray: TrayItem[] } {
  const next = [...layout];
  const out = next[slot];
  next[slot] = atSlot(tray[item].preset, slot + 1);
  const rest = tray.filter((_, k) => k !== item);
  return { layout: next, tray: out ? [...rest, { file: `from ${presetLabel(slot + 1)}`, preset: out }] : rest };
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
    const safe = safeFileName(presetName(p)) || 'preset';
    const label = paddedLabel(i + 1);
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
  const presets = await Promise.all(
    files.map(async (f) => ({
      slot: f.filename.slice(0, 3),
      file: f.filename,
      name: presetName(layout[slotOfFile(f.filename)! - 1]!),
      sha256: await sha256Hex(encoder.encode(f.json)),
    })),
  );
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
 * Place .mo files into slots: a file named "01A …" goes to that slot; any other file goes where `reference` (names by
 * slot) has a preset of the same name. A name shown in several slots fills all of them. Files no slot takes are
 * returned as `unplaced`.
 */
export function placeByName(
  files: { file: string; mo: MoFile }[],
  reference: (string | undefined)[],
): { layout: Layout; unplaced: TrayItem[] } {
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
  for (const f of rest) byName.set(trimName(f.mo.fileInfo?.preset_name ?? f.file), { file: f.file, preset: moToPreset(f.mo, 1) });
  const used = new Set<string>();
  Array.from({ length: PRESET_COUNT }, (_, i) => {
    if (bySlot.has(i + 1)) return;
    const name = trimName(reference[i] ?? '');
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

/** A name usable as a file name everywhere: characters file systems refuse become "_". */
const safeFileName = (name: string) => name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_');

/** "GE150PRO <name> 2026-11-14-10-15-42.json": the file name of a backup file. */
export function backupFileName(name: string, created: string): string {
  return `GE150PRO ${safeFileName(name)} ${created.slice(0, 19).replace(/[:T]/g, '-')}.json`;
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

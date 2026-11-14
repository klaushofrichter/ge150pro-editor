// The factory presets in Mooer's downloads. The firmware (.mr) holds the 200 factory presets: 200 names of 16 bytes,
// then 200 bodies of 228 bytes (the preset body without index and name: 9 modules, then the EXP settings), in factory
// slot order. The .mr ships inside Mooer's editor package: for the Mac a .zip holding a .dmg (UDIF, zlib compressed)
// holding the editor app with the .mr in it. This reads the table from any of the three, in the browser, and accepts it
// only if it is byte for byte the known factory table (SHA-256; identical in V2.1.2 and V2.1.4). See
// docs/protocol.md, Factory presets.
import type { Layout } from './arrange';
import { decodePreset, MODULE_BYTES, PRESET_BODY_BYTES, PRESET_COUNT, SLOT_COUNT } from './protocol/preset';

const NAME_BYTES = 16;
const BODY_BYTES = SLOT_COUNT * MODULE_BYTES + 12; // 228
export const TABLE_BYTES = PRESET_COUNT * (NAME_BYTES + BODY_BYTES); // 48,800

/** SHA-256 of the factory table (V2.1.2 and V2.1.4). */
export const FACTORY_TABLE_SHA256 = 'd7a4649f41140fa238d0f8ddb07013428da88bc7e9447bc60652725702194956';
/** The table starts with the first two names, "65 Deluxe" and "65 Twin", each padded to 16 bytes. */
const ANCHOR = (() => {
  const a = new Uint8Array(2 * NAME_BYTES);
  a.set(new TextEncoder().encode('65 Deluxe'), 0);
  a.set(new TextEncoder().encode('65 Twin'), NAME_BYTES);
  return a;
})();

/** The firmware images examined, to name the version of a .mr. */
export const KNOWN_FIRMWARE = [
  { version: 'V2.1.2', sha256: '96c3963a2c06b1787337f5f3ba13f1360a80aad71ccc16d36546b3609ea61e09' },
  { version: 'V2.1.4', sha256: '4ffd2b6aa7349444d7e4c3adc06d933f0e412282511a32675991f520994e522a' },
] as const;

export async function sha256Hex(b: Uint8Array): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', b as Uint8Array<ArrayBuffer>));
  return [...d].map((x) => x.toString(16).padStart(2, '0')).join('');
}

// ---- finding the table in a stream of bytes -------------------------------------------------------------------

function indexOf(hay: Uint8Array, needle: Uint8Array, from = 0): number {
  const first = needle[0];
  for (let i = hay.indexOf(first, from); i >= 0 && i + needle.length <= hay.length; i = hay.indexOf(first, i + 1)) {
    let k = 1;
    while (k < needle.length && hay[i + k] === needle[k]) k++;
    if (k === needle.length) return i;
  }
  return -1;
}

/**
 * Looks for a table of `length` bytes starting with `anchor` and hashing to `sha256` in bytes that arrive in pieces
 * (the table may span pieces). `push` returns the table once it has been seen whole.
 */
export class TableScanner {
  private carry = new Uint8Array(0);

  constructor(
    private anchor = ANCHOR,
    private length = TABLE_BYTES,
    private sha256 = FACTORY_TABLE_SHA256,
  ) {}

  async push(piece: Uint8Array): Promise<Uint8Array | null> {
    const buf = new Uint8Array(this.carry.length + piece.length);
    buf.set(this.carry);
    buf.set(piece, this.carry.length);
    for (let at = indexOf(buf, this.anchor); at >= 0; at = indexOf(buf, this.anchor, at + 1)) {
      if (at + this.length > buf.length) {
        this.carry = buf.slice(at); // the rest of this candidate comes with the next piece
        return null;
      }
      const table = buf.slice(at, at + this.length);
      if ((await sha256Hex(table)) === this.sha256) return table;
    }
    this.carry = buf.slice(Math.max(0, buf.length - this.anchor.length + 1));
    return null;
  }
}

// ---- containers -----------------------------------------------------------------------------------------------

async function inflate(data: Uint8Array, format: 'deflate' | 'deflate-raw'): Promise<Uint8Array> {
  const stream = new Blob([data as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream(format));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

const u16 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
const u32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
const u32be = (b: Uint8Array, o: number) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
const u64be = (b: Uint8Array, o: number) => u32be(b, o) * 2 ** 32 + u32be(b, o + 4);

/** The entries of a .zip, from its central directory: name and a function that returns the uncompressed bytes. */
function zipEntries(zip: Uint8Array): { name: string; data: () => Promise<Uint8Array> }[] {
  let eocd = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 65557); i--) {
    if (u32(zip, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return [];
  const count = u16(zip, eocd + 10);
  let p = u32(zip, eocd + 16);
  const out = [];
  for (let n = 0; n < count && u32(zip, p) === 0x02014b50; n++) {
    const method = u16(zip, p + 10);
    const size = u32(zip, p + 20);
    const nameLen = u16(zip, p + 28);
    const extraLen = u16(zip, p + 30);
    const commentLen = u16(zip, p + 32);
    const local = u32(zip, p + 42);
    const name = new TextDecoder().decode(zip.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    const start = local + 30 + u16(zip, local + 26) + u16(zip, local + 28);
    const raw = () => zip.subarray(start, start + size);
    if (method === 0) out.push({ name, data: async () => raw() });
    else if (method === 8) out.push({ name, data: () => inflate(raw(), 'deflate-raw') });
  }
  return out;
}

const isDmg = (b: Uint8Array) => b.length > 512 && u32be(b, b.length - 512) === 0x6b6f6c79; // "koly"

/** The table in a UDIF disk image (.dmg), reading its chunks in order (raw, zero-filled or zlib compressed). */
async function scanDmg(dmg: Uint8Array): Promise<Uint8Array | null> {
  const koly = dmg.length - 512;
  const dataFork = u64be(dmg, koly + 0x18);
  const xml = new TextDecoder().decode(dmg.subarray(u64be(dmg, koly + 0xd8), u64be(dmg, koly + 0xd8) + u64be(dmg, koly + 0xe0)));
  const blocks = [...xml.matchAll(/<data>([^<]+)<\/data>/g)]
    .map((m) => Uint8Array.from(atob(m[1].replace(/\s+/g, '')), (c) => c.charCodeAt(0)))
    .filter((b) => b.length >= 204 && u32be(b, 0) === 0x6d697368); // "mish"
  for (const mish of blocks) {
    const scanner = new TableScanner();
    const chunks = u32be(mish, 200);
    for (let c = 0; c < chunks; c++) {
      const e = 204 + c * 40;
      const type = u32be(mish, e);
      const sectors = u64be(mish, e + 16);
      const off = dataFork + u64be(mish, e + 24);
      const len = u64be(mish, e + 32);
      let piece: Uint8Array | null = null;
      if (type === 0x80000005) piece = await inflate(dmg.subarray(off, off + len), 'deflate');
      else if (type === 1) piece = dmg.subarray(off, off + len);
      else if (type === 0 || type === 2) piece = new Uint8Array(sectors * 512);
      if (!piece) continue; // comments, end marker; other compressions (bzip2, lzfse) are not used by Mooer's images
      const table = await scanner.push(piece);
      if (table) return table;
    }
  }
  return null;
}

/** The factory table in a downloaded file: a .mr, a .dmg, or a .zip holding either. */
async function findTable(name: string, bytes: Uint8Array, depth = 0): Promise<{ table: Uint8Array; from: string } | null> {
  if (u32(bytes, 0) === 0x04034b50 && depth < 2) {
    const entries = zipEntries(bytes).sort((a, b) => rank(a.name) - rank(b.name));
    for (const e of entries) {
      if (rank(e.name) > 2) continue; // only .mr and .dmg entries are opened
      const found = await findTable(e.name, await e.data(), depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (isDmg(bytes)) {
    const table = await scanDmg(bytes);
    return table && { table, from: name };
  }
  const table = await new TableScanner().push(bytes);
  return table && { table, from: name };
}

const rank = (name: string) => (/\.mr$/i.test(name) ? 1 : /\.dmg$/i.test(name) ? 2 : 3);

function tableToLayout(table: Uint8Array): Layout {
  const bodies = PRESET_COUNT * NAME_BYTES;
  return Array.from({ length: PRESET_COUNT }, (_, i) => {
    const body = new Uint8Array(PRESET_BODY_BYTES);
    body[0] = i + 1;
    body.set(table.subarray(i * NAME_BYTES, (i + 1) * NAME_BYTES), 1);
    body.set(table.subarray(bodies + i * BODY_BYTES, bodies + (i + 1) * BODY_BYTES), 1 + NAME_BYTES);
    const p = decodePreset(body);
    // REVERB v4 (the SHIMMER parameter) is 0 in the table and 65 on a pedal holding the factory preset
    const rev = p.modules[SLOT_COUNT - 1];
    if (rev.values[4] === 0) rev.values[4] = 65;
    return p;
  });
}

/**
 * The factory presets from a file the user picked: a firmware image (.mr), Mooer's editor disk image (.dmg) or the
 * .zip it is downloaded as. Null when the file does not hold the known factory table. Values the pedal corrects when
 * it stores a preset stay as the firmware has them (comparisons use canonical()).
 */
export async function factoryFromFile(name: string, bytes: Uint8Array): Promise<{ version: string; layout: Layout } | null> {
  const found = await findTable(name, bytes);
  if (!found) return null;
  const hash = /\.mr$/i.test(name) ? await sha256Hex(bytes) : '';
  const fromName = /v?(\d+\.\d+\.\d+)/i.exec(found.from) ?? /v?(\d+\.\d+\.\d+)/i.exec(name);
  const version = KNOWN_FIRMWARE.find((k) => k.sha256 === hash)?.version ?? (fromName ? `V${fromName[1]}` : 'unknown version');
  return { version, layout: tableToLayout(found.table) };
}

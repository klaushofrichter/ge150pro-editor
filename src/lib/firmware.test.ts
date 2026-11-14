import { describe, expect, it } from 'vitest';
import { factoryFromFile, sha256Hex, TableScanner } from './firmware';

describe('finding the table in pieces', () => {
  const anchor = new TextEncoder().encode('ANCHOR');
  const table = new Uint8Array(1000).map((_, i) => (i * 7) % 251);
  table.set(anchor, 0);
  const noise = (n: number, seed: number) => new Uint8Array(n).map((_, i) => (i * seed + 3) % 241);

  it('finds a table that spans several pieces, and checks it by its hash', async () => {
    const sha = await sha256Hex(table);
    const stream = new Uint8Array([...noise(5000, 13), ...table, ...noise(3000, 17)]);
    for (const size of [7, 300, 999, 4096, 100_000]) {
      const scanner = new TableScanner(anchor, table.length, sha);
      let got: Uint8Array | null = null;
      for (let o = 0; o < stream.length && !got; o += size) got = await scanner.push(stream.subarray(o, o + size));
      expect(got, `pieces of ${size}`).toEqual(table);
    }
  });

  it('rejects a table with the right start but other content', async () => {
    const other = table.slice();
    other[500] ^= 1;
    const scanner = new TableScanner(anchor, table.length, await sha256Hex(table));
    expect(await scanner.push(new Uint8Array([...noise(100, 5), ...other, ...noise(100, 9)]))).toBeNull();
  });
});

describe("Mooer's downloads", async () => {
  it('rejects a file without the factory table', async () => {
    expect(await factoryFromFile('x.mr', new Uint8Array(1_200_000).fill(7))).toBeNull();
    expect(await factoryFromFile('x.zip', new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0]))).toBeNull();
  });

  // The files are not in the repository: these run where a local copy exists (work/firmware/).
  const fs = (await import(/* @vite-ignore */ `node:${'fs'}`)) as { existsSync(p: URL): boolean; readFileSync(p: URL): Uint8Array };
  const files: [string, string][] = [
    ['GE150PRO_V2.1.2.mr', 'V2.1.2'],
    ['GE150PRO_V2.1.4.mr', 'V2.1.4'],
    ['ge150_pro_v2.1.4_mac.zip', 'V2.1.4'],
  ];
  for (const [file, version] of files) {
    const local = new URL(`../../work/firmware/${file}`, import.meta.url);
    it.runIf(fs.existsSync(local))(`reads the factory presets from ${file}`, { timeout: 60_000 }, async () => {
      const got = (await factoryFromFile(file, new Uint8Array(fs.readFileSync(local))))!;
      expect(got.version).toBe(version);
      const l = got.layout;
      expect(l.slice(0, 5).map((p) => p!.name)).toEqual(['65 Deluxe', '65 Twin', '59 Bassguy', 'Sonic Drive', 'US Blues Clean']);
      expect(l[199]!.name).toBe('Dual Lead');
      expect(l[0]!.modules[8].values[4]).toBe(65);
    });
  }
});

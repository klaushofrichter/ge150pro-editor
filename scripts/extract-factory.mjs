#!/usr/bin/env node
// Extract the 200 factory presets from a known GE150 Pro firmware image (.mr) as .mo files, "01A Name.mo" …
// "50D Name.mo", plus manifest.json (an immutable original: name, dates, firmware and its SHA-256, a checksum per file).
// The folder must not exist yet; afterwards the files and the folder are read-only, so the set stays as extracted.
// Only the images listed in src/lib/arrange.ts (KNOWN_FIRMWARE) are accepted.
//
//   node scripts/extract-factory.mjs work/firmware/GE150PRO_V2.1.2.mr work/factory-mo-V2.1.2
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, join } from 'node:path';
import { createServer } from 'vite';

const [fwPath, outDir] = process.argv.slice(2);
if (!fwPath || !outDir) {
  console.error('usage: node scripts/extract-factory.mjs <firmware.mr> <new folder>');
  process.exit(2);
}
if (existsSync(outDir)) {
  console.error(`${outDir} exists already: nothing written (the extracted set is never overwritten)`);
  process.exit(1);
}

// the app's own code (TypeScript), loaded through Vite
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { factoryFromFirmware, moSet, KNOWN_FIRMWARE } = await vite.ssrLoadModule('/src/lib/arrange.ts');
  const fw = new Uint8Array(readFileSync(fwPath));
  const got = await factoryFromFirmware(fw);
  if (!got) {
    console.error(`${basename(fwPath)} is not a known firmware image (${KNOWN_FIRMWARE.map((k) => k.version).join(', ')})`);
    process.exit(1);
  }
  const sha = createHash('sha256').update(fw).digest('hex');
  const files = await moSet(got.layout, {
    name: `GE150 Pro factory presets (firmware ${got.version})`,
    kind: 'original',
    immutable: true,
    description: 'The factory presets of the GE150 Pro, read from the firmware image. Immutable: keep this set unchanged; restore from it.',
    source: { type: 'firmware', version: got.version, file: basename(fwPath), sha256: sha },
  });
  mkdirSync(outDir, { recursive: true });
  for (const f of files) {
    writeFileSync(join(outDir, f.filename), f.json);
    chmodSync(join(outDir, f.filename), 0o444);
  }
  chmodSync(outDir, 0o555);
  console.log(`${files.length - 1} factory presets of firmware ${got.version} in ${outDir} (read-only)`);
} finally {
  await vite.close();
}

// Preset backups kept in this browser (IndexedDB). One of them can be the locked original, the factory set read
// from a firmware image: it is never changed or deleted. Backup files (export/import) use the format of arrange.ts.
import type { Layout } from './arrange';

export interface Backup {
  id: string;
  name: string;
  created: string;
  /** Where it came from: the pedal, a backup file, .mo files, or the firmware's factory set. */
  source: 'pedal' | 'file' | 'mo' | 'factory';
  /** Locked backups cannot be changed or deleted. */
  locked: boolean;
  layout: Layout;
}

export const ORIGINAL_ID = 'original';

const DB = 'ge150pro-editor';
const STORE = 'backups';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/** All backups, newest first, the original on top. */
export async function listBackups(): Promise<Backup[]> {
  const all = await run<Backup[]>('readonly', (s) => s.getAll() as IDBRequest<Backup[]>);
  return all.sort((a, b) => (a.id === ORIGINAL_ID ? -1 : b.id === ORIGINAL_ID ? 1 : b.created.localeCompare(a.created)));
}

/** Save a new backup. A locked backup with the same id is never replaced. */
export async function saveBackup(b: Omit<Backup, 'id' | 'created'> & { id?: string; created?: string }): Promise<Backup> {
  const backup: Backup = { ...b, id: b.id ?? crypto.randomUUID(), created: b.created ?? new Date().toISOString() };
  const existing = await run<Backup | undefined>('readonly', (s) => s.get(backup.id) as IDBRequest<Backup | undefined>);
  if (existing?.locked) throw new Error(`"${existing.name}" is locked and cannot be replaced`);
  await run('readwrite', (s) => s.put(JSON.parse(JSON.stringify(backup))));
  return backup;
}

export async function deleteBackup(id: string): Promise<void> {
  const existing = await run<Backup | undefined>('readonly', (s) => s.get(id) as IDBRequest<Backup | undefined>);
  if (existing?.locked) throw new Error(`"${existing.name}" is locked and cannot be deleted`);
  await run('readwrite', (s) => s.delete(id));
}

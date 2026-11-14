// Browser file helpers shared by the UI: folders (File System Access API, Chrome and Edge), downloads, and asking
// for a preset name.
import { NAME_LENGTH } from './protocol/preset';

type DirectoryPicker = { showDirectoryPicker(o?: { id?: string; mode?: 'read' | 'readwrite' }): Promise<FileSystemDirectoryHandle> };

/** Whether this browser can open folders. */
export const folderSupported = () => typeof window !== 'undefined' && 'showDirectoryPicker' in window;

/** Ask for a folder; null when the user cancels. Other failures (a folder the browser refuses) are thrown. */
export async function pickDirectory(id: string, mode: 'read' | 'readwrite' = 'read'): Promise<FileSystemDirectoryHandle | null> {
  try {
    return await (window as unknown as DirectoryPicker).showDirectoryPicker({ id, mode });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return null;
    throw e;
  }
}

/** The files directly in a folder. */
export async function* dirFiles(dir: FileSystemDirectoryHandle): AsyncGenerator<FileSystemFileHandle> {
  for await (const entry of (dir as unknown as { values(): AsyncIterable<FileSystemHandle> }).values()) {
    if (entry.kind === 'file') yield entry as FileSystemFileHandle;
  }
}

/** Offer text as a file download. */
export function downloadText(filename: string, text: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  Object.assign(document.createElement('a'), { href: url, download: filename }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Ask for a preset name: trimmed, at most 16 characters ('' when left empty); null when cancelled. */
export function askPresetName(message: string, initial: string): string | null {
  const name = prompt(`${message} (max ${NAME_LENGTH}):`, initial);
  return name === null ? null : name.trim().slice(0, NAME_LENGTH);
}

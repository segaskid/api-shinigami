import envPaths from 'env-paths';
import { readDataFile, writeTextFile, fileExists } from '../utils/fs.js';
import { redactObject } from './secretRedactor.js';

export interface HistoryEntry {
  id: string;
  timestamp: string;
  kind: string;
  data: unknown;
}

const paths = envPaths('api-shinigami');
const historyFile = `${paths.data}/history.json`;

export async function addHistoryEntry(entry: HistoryEntry): Promise<void> {
  try {
    const entries = await listHistoryEntries();
    entries.unshift(redactObject(entry));
    await writeTextFile(historyFile, JSON.stringify(entries.slice(0, 100), null, 2));
  } catch {
    // History must never make a successful request fail.
  }
}

export async function listHistoryEntries(): Promise<HistoryEntry[]> {
  if (!(await fileExists(historyFile))) {
    return [];
  }
  const data = await readDataFile(historyFile);
  return Array.isArray(data) ? (data as HistoryEntry[]) : [];
}

export async function clearHistory(): Promise<void> {
  try {
    await writeTextFile(historyFile, '[]\n');
  } catch {
    // Ignore unavailable local storage.
  }
}

export async function getHistoryEntry(id: string): Promise<HistoryEntry | undefined> {
  return (await listHistoryEntries()).find((entry) => entry.id === id);
}

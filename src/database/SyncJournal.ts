import * as FileSystem from 'expo-file-system';
import { JOURNAL_FILENAME } from '@/constants';
import { JournalEntry, SyncStatus, WriteOperation } from '@/types';

/**
 * The journal is a plain append-only JSON-lines file, deliberately kept
 * OUTSIDE both SQLite databases. Its job is to answer one question even if
 * the app is killed mid-write: "which operations might not have made it to
 * both databases, and what were they?" A corrupted SQLite file cannot take
 * this record down with it, and vice versa.
 *
 * Every entry is rewritten in place by re-serializing the whole log after
 * each status transition. This app's data volumes (a small retail shop's
 * billing history) make this a non-issue in practice; if this were a much
 * higher-volume system you would switch to a proper append+compaction
 * scheme instead of rewriting the whole file every time.
 */
export class SyncJournal {
  private readonly path: string;

  constructor(baseDir: string = FileSystem.documentDirectory ?? '') {
    this.path = `${baseDir}${JOURNAL_FILENAME}`;
  }

  private async readAll(): Promise<JournalEntry[]> {
    const info = await FileSystem.getInfoAsync(this.path);
    if (!info.exists) return [];
    const contents = await FileSystem.readAsStringAsync(this.path);
    if (!contents.trim()) return [];
    return contents
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as JournalEntry);
  }

  private async writeAll(entries: JournalEntry[]): Promise<void> {
    const contents = entries.map((e) => JSON.stringify(e)).join('\n') + '\n';
    await FileSystem.writeAsStringAsync(this.path, contents);
  }

  async recordPending(op: WriteOperation): Promise<void> {
    const entries = await this.readAll();
    const now = new Date().toISOString();
    entries.push({
      opId: op.id,
      description: op.description,
      statements: op.statements,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      attempts: 0,
    });
    // Keep the journal from growing without bound: drop entries that have
    // long since been fully synchronized and are older than the most
    // recent 500 operations.
    const trimmed = this.trim(entries);
    await this.writeAll(trimmed);
  }

  async updateStatus(opId: string, status: SyncStatus, incrementAttempt = false): Promise<void> {
    const entries = await this.readAll();
    const idx = entries.findIndex((e) => e.opId === opId);
    if (idx === -1) return;
    entries[idx].status = status;
    entries[idx].updatedAt = new Date().toISOString();
    if (incrementAttempt) entries[idx].attempts += 1;
    await this.writeAll(entries);
  }

  async getUnsynchronized(): Promise<JournalEntry[]> {
    const entries = await this.readAll();
    return entries.filter((e) => e.status !== 'both_ok');
  }

  async getAllEntries(): Promise<JournalEntry[]> {
    return this.readAll();
  }

  async getLastSyncedAt(): Promise<string | null> {
    const entries = await this.readAll();
    const synced = entries.filter((e) => e.status === 'both_ok');
    if (synced.length === 0) return null;
    return synced.reduce((latest, e) => (e.updatedAt > latest ? e.updatedAt : latest), synced[0].updatedAt);
  }

  private trim(entries: JournalEntry[]): JournalEntry[] {
    const MAX_SYNCED_KEPT = 500;
    const unsynced = entries.filter((e) => e.status !== 'both_ok');
    const synced = entries.filter((e) => e.status === 'both_ok');
    const keptSynced = synced.slice(Math.max(0, synced.length - MAX_SYNCED_KEPT));
    return [...keptSynced, ...unsynced].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
}

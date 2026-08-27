import * as FileSystem from 'expo-file-system';
import { DatabaseConnection } from './DatabaseConnection';
import { RECOVERY_LOG_FILENAME } from '@/constants';

// Tables in dependency order (referenced tables first) so foreign keys are
// satisfied as rows are re-inserted.
const TABLES_IN_ORDER = [
  'schema_meta',
  'users',
  'articles',
  'article_sizes',
  'bills',
  'bill_items',
  'app_settings',
  'draft_bills',
  'draft_bill_items',
  'applied_operations',
  'bill_counter',
];

async function appendRecoveryLog(message: string): Promise<void> {
  const path = `${FileSystem.documentDirectory}${RECOVERY_LOG_FILENAME}`;
  const line = `${new Date().toISOString()} ${message}\n`;
  const info = await FileSystem.getInfoAsync(path);
  if (info.exists) {
    const existing = await FileSystem.readAsStringAsync(path);
    await FileSystem.writeAsStringAsync(path, existing + line);
  } else {
    await FileSystem.writeAsStringAsync(path, line);
  }
}

/**
 * Rebuilds `target` from `source` entirely: renames any existing (corrupt)
 * target file aside for forensics rather than deleting it outright, opens
 * a brand new database at that path, recreates the schema, then copies
 * every row of every table across inside a single transaction per table.
 *
 * This is invoked automatically by DualDatabaseManager.initialize() when
 * the primary fails its health check and the secondary is healthy. It can
 * also be invoked manually (e.g. from a "force resync" action in Settings)
 * to bring a lagging standby back in line with the active database.
 */
export async function rebuildDatabaseFrom(
  source: DatabaseConnection,
  target: DatabaseConnection
): Promise<void> {
  await appendRecoveryLog(
    `Starting rebuild of ${target.label} (${target.fullFilePath}) from ${source.label}`
  );

  try {
    await target.close();
  } catch {
    // ignore -- it may already be unusable
  }

  const corruptPath = `${target.fullFilePath}.corrupt.${Date.now()}`;
  const info = await FileSystem.getInfoAsync(target.fullFilePath);
  if (info.exists) {
    try {
      await FileSystem.moveAsync({ from: target.fullFilePath, to: corruptPath });
      await appendRecoveryLog(`Moved corrupted file aside to ${corruptPath}`);
    } catch (err) {
      // If we can't even move it aside, try deleting so a fresh file can
      // be created in its place. Data forensics is secondary to getting
      // the user back to a working state.
      await FileSystem.deleteAsync(target.fullFilePath, { idempotent: true });
      await appendRecoveryLog(`Could not move corrupted file, deleted instead: ${String(err)}`);
    }
  }

  await target.open();
  await target.runMigrations();

  const sourceDb = source.getHandle();
  const targetDb = target.getHandle();

  for (const table of TABLES_IN_ORDER) {
    const rows = await sourceDb.getAllAsync<Record<string, unknown>>(`SELECT * FROM ${table};`);
    if (rows.length === 0) continue;
    const columns = Object.keys(rows[0]);
    const placeholders = columns.map(() => '?').join(', ');
    const insertSql = `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders});`;
    await targetDb.withTransactionAsync(async () => {
      for (const row of rows) {
        const values = columns.map((c) => row[c] as string | number | null);
        await targetDb.runAsync(insertSql, values);
      }
    });
  }

  await appendRecoveryLog(`Rebuild of ${target.label} complete: copied data for ${TABLES_IN_ORDER.length} tables`);
}

export async function getRecoveryLog(): Promise<string> {
  const path = `${FileSystem.documentDirectory}${RECOVERY_LOG_FILENAME}`;
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) return '';
  return FileSystem.readAsStringAsync(path);
}

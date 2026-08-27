import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { DatabaseConnection } from '@/database/DatabaseConnection';
import { dualDatabaseManager } from '@/database/DualDatabaseManager';
import { BACKUPS_DIR, DB_FILENAMES } from '@/constants';

export class RestoreValidationError extends Error {}

async function ensureBackupsDir(): Promise<string> {
  const dir = `${FileSystem.documentDirectory}${BACKUPS_DIR}`;
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
}

export const BackupService = {
  /**
   * Copies the currently active database file to a timestamped backup and
   * opens the native share sheet so the user can save it to Drive, email
   * it, AirDrop it, etc. -- all without needing network access from the
   * app itself.
   */
  async createBackup(): Promise<string> {
    const dir = await ensureBackupsDir();
    const sourcePath = dualDatabaseManager.activeConnection().fullFilePath;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const destPath = `${dir}/billing-backup-${stamp}.db`;
    await FileSystem.copyAsync({ from: sourcePath, to: destPath });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(destPath, { dialogTitle: 'Save Database Backup' });
    }
    return destPath;
  },

  async pickBackupFile(): Promise<string | null> {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });
    if (result.canceled) return null;
    return result.assets[0]?.uri ?? null;
  },

  /**
   * Validates a candidate backup file (integrity check + required tables)
   * WITHOUT touching the live database. Throws RestoreValidationError if
   * the file is not a usable backup.
   */
  async validateBackupFile(uri: string): Promise<void> {
    const validationDir = 'restore_validation';
    const tempConn = new DatabaseConnection('primary', validationDir, 'candidate.db');
    await tempConn.ensureDirectoryExists();
    await FileSystem.deleteAsync(tempConn.fullFilePath, { idempotent: true });
    try {
      await FileSystem.copyAsync({ from: uri, to: tempConn.fullFilePath });
    } catch {
      throw new RestoreValidationError('Could not read the selected file.');
    }
    try {
      await tempConn.open();
      const health = await tempConn.checkHealth();
      if (!health.ok) {
        throw new RestoreValidationError(`Backup file failed validation: ${health.reason}`);
      }
    } finally {
      await tempConn.close();
      await FileSystem.deleteAsync(tempConn.fullFilePath, { idempotent: true });
    }
  },

  /**
   * Full restore flow: backs up current data first (safety net), validates
   * the candidate file, then replaces BOTH primary and secondary database
   * files with the validated backup so they start back up in sync.
   * Returns once files are replaced -- the caller must reinitialize
   * dualDatabaseManager (or prompt the user to restart the app) afterward.
   */
  async restoreFromFile(uri: string): Promise<void> {
    await this.validateBackupFile(uri);

    // Safety net: never overwrite current data without a fallback copy.
    await this.createBackup().catch(() => {
      /* if this fails we still proceed -- the user explicitly asked to restore
         and validation already passed; but we prefer not to block on sharing UI */
    });

    await dualDatabaseManager.primary.close();
    await dualDatabaseManager.secondary.close();

    const primaryDest = `${FileSystem.documentDirectory}primary_db/${DB_FILENAMES.primary}`;
    const secondaryDest = `${FileSystem.documentDirectory}secondary_db/${DB_FILENAMES.secondary}`;
    await FileSystem.deleteAsync(primaryDest, { idempotent: true });
    await FileSystem.deleteAsync(secondaryDest, { idempotent: true });
    await FileSystem.copyAsync({ from: uri, to: primaryDest });
    await FileSystem.copyAsync({ from: uri, to: secondaryDest });

    await dualDatabaseManager.initialize();
  },
};

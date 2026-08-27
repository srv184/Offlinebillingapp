import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';
import { CREATE_STATEMENTS, SEED_STATEMENTS } from './schema';
import { REQUIRED_TABLES, SCHEMA_VERSION } from '@/constants';
import { DatabaseHealth, SqlStatement } from '@/types';

/**
 * Thin wrapper around a single expo-sqlite database handle. Two instances
 * of this class exist at runtime -- one for the primary DB directory, one
 * for the secondary -- and they are never allowed to point at the same
 * physical file/directory.
 */
export class DatabaseConnection {
  readonly label: 'primary' | 'secondary';
  readonly directory: string;
  readonly filename: string;
  private db: SQLite.SQLiteDatabase | null = null;

  constructor(label: 'primary' | 'secondary', directory: string, filename: string) {
    this.label = label;
    this.directory = directory;
    this.filename = filename;
  }

  private get fullDirPath(): string {
    return `${FileSystem.documentDirectory}${this.directory}`;
  }

  get fullFilePath(): string {
    return `${this.fullDirPath}/${this.filename}`;
  }

  async ensureDirectoryExists(): Promise<void> {
    const info = await FileSystem.getInfoAsync(this.fullDirPath);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(this.fullDirPath, { intermediates: true });
    }
  }

  /** Opens the database file, creating the directory + schema if needed. */
  async open(): Promise<void> {
    await this.ensureDirectoryExists();
    const db = await (SQLite.openDatabaseAsync as any)(this.filename, {}, this.fullDirPath);
    this.db = db;
    if (!this.db) {
      throw new Error(`Failed to open database ${this.filename}`);
    }
    await this.db.execAsync('PRAGMA journal_mode = WAL;');
    await this.db.execAsync('PRAGMA foreign_keys = ON;');
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.closeAsync();
      this.db = null;
    }
  }

  getHandle(): SQLite.SQLiteDatabase {
    if (!this.db) {
      throw new Error(`DatabaseConnection(${this.label}) used before open()`);
    }
    return this.db;
  }

  /** Creates every table if missing and records/verifies schema_meta version. */
  async runMigrations(): Promise<void> {
    const db = this.getHandle();
    await db.withTransactionAsync(async () => {
      for (const stmt of CREATE_STATEMENTS) {
        await db.execAsync(stmt);
      }
      for (const seed of SEED_STATEMENTS) {
        await db.runAsync(seed.sql, seed.params);
      }
      const row = await db.getFirstAsync<{ version: number }>(
        'SELECT version FROM schema_meta WHERE id = 1;'
      );
      if (!row) {
        await db.runAsync('INSERT INTO schema_meta (id, version) VALUES (1, ?);', [
          SCHEMA_VERSION,
        ]);
      }
      // Future schema bumps: add ALTER TABLE / migration steps here, gated
      // on the stored version, then update schema_meta.version.
    });
  }

  async execStatements(statements: SqlStatement[]): Promise<void> {
    const db = this.getHandle();
    await db.withTransactionAsync(async () => {
      for (const s of statements) {
        await db.runAsync(s.sql, s.params ?? []);
      }
    });
  }

  async getAll<T>(sql: string, params: (string | number | null)[] = []): Promise<T[]> {
    return this.getHandle().getAllAsync<T>(sql, params);
  }

  async getFirst<T>(sql: string, params: (string | number | null)[] = []): Promise<T | null> {
    const result = await this.getHandle().getFirstAsync<T>(sql, params);
    return result ?? null;
  }

  async run(sql: string, params: (string | number | null)[] = []): Promise<void> {
    await this.getHandle().runAsync(sql, params);
  }

  /**
   * Full structural + data integrity check. Deliberately does NOT just
   * check "does the file exist" -- a file can exist while the SQLite
   * structure inside it is corrupt.
   */
  async checkHealth(): Promise<DatabaseHealth> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(this.fullFilePath);
      if (!fileInfo.exists) {
        return { ok: false, reason: 'file_missing' };
      }
      const db = this.getHandle();
      const integrityRows = await db.getAllAsync<{ integrity_check: string }>(
        'PRAGMA integrity_check;'
      );
      const integrityOk =
        integrityRows.length > 0 && integrityRows[0].integrity_check === 'ok';
      if (!integrityOk) {
        return { ok: false, reason: 'integrity_check_failed' };
      }
      const tables = await db.getAllAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table';"
      );
      const names = new Set(tables.map((t) => t.name));
      for (const required of REQUIRED_TABLES) {
        if (!names.has(required)) {
          return { ok: false, reason: `missing_table:${required}` };
        }
      }
      // Sanity query against a real table, not just sqlite_master metadata.
      await db.getFirstAsync('SELECT COUNT(*) as c FROM articles;');
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: `exception:${String(err)}` };
    }
  }
}

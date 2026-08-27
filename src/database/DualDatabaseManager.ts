import { DatabaseConnection } from './DatabaseConnection';
import { SyncJournal } from './SyncJournal';
import { DB_DIRS, DB_FILENAMES } from '@/constants';
import { ActiveDatabase, DatabaseStatusReport, SqlStatement, WriteOperation } from '@/types';
import { rebuildDatabaseFrom } from './RecoveryService';

/**
 * Central point through which ALL writes flow. Repositories never talk to
 * DatabaseConnection directly for writes -- they build a WriteOperation
 * (a description + a list of static SQL statements) and hand it to
 * applyOperation(). Reads go straight to whichever database is currently
 * active.
 *
 * Guarantees provided:
 *  - Every operation is applied to the ACTIVE database inside a single
 *    SQLite transaction (all-or-nothing on that database).
 *  - The same operation is then replayed against the other database.
 *  - Each database tracks which operation IDs it has already applied
 *    (`applied_operations` table), so replaying an operation it already
 *    has is a safe no-op. This is what makes journal replay after a crash
 *    safe: we can always just "try again" without double-applying.
 *  - A file-based journal (SyncJournal) records intent *before* touching
 *    SQLite, so even if the process is killed mid-operation we know what
 *    might still need reconciling on next launch.
 */
export class DualDatabaseManager {
  primary: DatabaseConnection;
  secondary: DatabaseConnection;
  private journal: SyncJournal;
  private _active: ActiveDatabase = 'primary';
  private _recoveryModeActive = false;

  constructor() {
    this.primary = new DatabaseConnection('primary', DB_DIRS.primary, DB_FILENAMES.primary);
    this.secondary = new DatabaseConnection(
      'secondary',
      DB_DIRS.secondary,
      DB_FILENAMES.secondary
    );
    this.journal = new SyncJournal();
  }

  get active(): ActiveDatabase {
    return this._active;
  }

  get recoveryModeActive(): boolean {
    return this._recoveryModeActive;
  }

  /** The connection reads/most business logic should use right now. */
  activeConnection(): DatabaseConnection {
    return this._active === 'primary' ? this.primary : this.secondary;
  }

  private standbyConnection(): DatabaseConnection {
    return this._active === 'primary' ? this.secondary : this.primary;
  }

  /**
   * Full startup sequence: open both DBs, run schema migrations on
   * whichever can be opened, health-check both, decide which is active,
   * trigger recovery if needed, then replay any unsynchronized journal
   * entries left over from a previous crash.
   */
  async initialize(): Promise<DatabaseStatusReport> {
    await this.safeOpenAndMigrate(this.primary);
    await this.safeOpenAndMigrate(this.secondary);

    const primaryHealth = await this.primary.checkHealth();
    const secondaryHealth = await this.secondary.checkHealth();

    if (primaryHealth.ok) {
      this._active = 'primary';
      this._recoveryModeActive = false;
    } else if (secondaryHealth.ok) {
      this._active = 'secondary';
      this._recoveryModeActive = true;
      // Attempt to reconstruct a fresh primary from the verified secondary.
      await rebuildDatabaseFrom(this.secondary, this.primary);
      const rebuiltHealth = await this.primary.checkHealth();
      if (rebuiltHealth.ok) {
        this._active = 'primary';
        this._recoveryModeActive = false;
      }
      // If rebuild still failed, we simply keep operating on secondary and
      // surface recoveryModeActive = true so Settings can show a clear,
      // non-alarming banner. The user's data is never inaccessible.
    } else {
      throw new Error(
        'Both primary and secondary databases failed integrity checks. Restore from a backup file in Settings > Restore Data.'
      );
    }

    await this.reconcileJournal();

    return this.getStatusReport();
  }

  private async safeOpenAndMigrate(conn: DatabaseConnection): Promise<void> {
    try {
      await conn.open();
      await conn.runMigrations();
    } catch {
      // Leave it -- checkHealth() will subsequently report it as unhealthy
      // and the caller decides how to react. We don't want an exception
      // here to crash app startup.
    }
  }

  /**
   * Applies a write to the active DB, then mirrors it to the standby DB.
   * Returns once the active DB write has succeeded; mirroring to standby
   * happens synchronously as part of the same call but a standby failure
   * does NOT throw -- it's recorded in the journal for reconciliation so
   * the user's action in front of them always completes.
   */
  async applyOperation(op: WriteOperation): Promise<void> {
    await this.journal.recordPending(op);

    const active = this.activeConnection();
    await this.applyToConnection(active, op);
    await this.journal.updateStatus(op.id, 'primary_ok');

    try {
      const standby = this.standbyConnection();
      await this.applyToConnection(standby, op);
      await this.journal.updateStatus(op.id, 'both_ok');
    } catch (err) {
      await this.journal.updateStatus(op.id, 'secondary_pending', true);
      // Swallowed deliberately: the user's operation succeeded on the
      // active database. Reconciliation will retry the standby copy.
    }
  }

  /** Idempotent: does nothing if this connection already applied opId. */
  private async applyToConnection(conn: DatabaseConnection, op: WriteOperation): Promise<void> {
    const db = conn.getHandle();
    await db.withTransactionAsync(async () => {
      const already = await db.getFirstAsync<{ id: string }>(
        'SELECT id FROM applied_operations WHERE id = ?;',
        [op.id]
      );
      if (already) {
        return; // already applied to this DB -- safe no-op
      }
      for (const stmt of op.statements) {
        await db.runAsync(stmt.sql, stmt.params ?? []);
      }
      await db.runAsync(
        'INSERT INTO applied_operations (id, description, applied_at) VALUES (?, ?, ?);',
        [op.id, op.description, new Date().toISOString()]
      );
    });
  }

  /**
   * Replays anything left in a non both_ok state. Safe to call on every
   * app startup and periodically in the background -- reapplying an
   * already-applied operation to a given DB is a guaranteed no-op thanks
   * to the applied_operations guard above.
   */
  async reconcileJournal(): Promise<void> {
    const pending = await this.journal.getUnsynchronized();
    for (const entry of pending) {
      try {
        await this.applyToConnection(this.primary, {
          id: entry.opId,
          description: entry.description,
          statements: entry.statements,
        });
        await this.applyToConnection(this.secondary, {
          id: entry.opId,
          description: entry.description,
          statements: entry.statements,
        });
        await this.journal.updateStatus(entry.opId, 'both_ok');
      } catch {
        await this.journal.updateStatus(entry.opId, 'failed', true);
      }
    }
  }

  async getStatusReport(): Promise<DatabaseStatusReport> {
    const primaryHealth = await this.primary.checkHealth();
    const secondaryHealth = await this.secondary.checkHealth();
    const lastSync = await this.journal.getLastSyncedAt();
    const unsynced = await this.journal.getUnsynchronized();
    return {
      primary: primaryHealth,
      secondary: secondaryHealth,
      active: this._active,
      lastSynchronizedAt: lastSync,
      synchronized: unsynced.length === 0,
      schemaVersion: 1,
      recoveryModeActive: this._recoveryModeActive,
    };
  }

  /** Read helper -- always reads from whichever DB is currently active. */
  async readAll<T>(sql: string, params: (string | number | null)[] = []): Promise<T[]> {
    return this.activeConnection().getAll<T>(sql, params);
  }

  async readFirst<T>(sql: string, params: (string | number | null)[] = []): Promise<T | null> {
    return this.activeConnection().getFirst<T>(sql, params);
  }
}

// Re-exported so repositories can build statements without importing the
// types module directly in every file.
export type { SqlStatement };

export const dualDatabaseManager = new DualDatabaseManager();

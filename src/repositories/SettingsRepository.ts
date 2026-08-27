import { dualDatabaseManager } from '@/database/DualDatabaseManager';
import { DEFAULT_INACTIVITY_TIMEOUT_MINUTES, SETTINGS_KEYS } from '@/constants';
import { generateId } from '@/utils/id';

interface SettingRow {
  key: string;
  value: string | null;
  updated_at: string;
}

export const SettingsRepository = {
  async get(key: string): Promise<string | null> {
    const row = await dualDatabaseManager.readFirst<SettingRow>(
      `SELECT * FROM app_settings WHERE key = ?;`,
      [key]
    );
    return row?.value ?? null;
  },

  async set(key: string, value: string): Promise<void> {
    const now = new Date().toISOString();
    await dualDatabaseManager.applyOperation({
      id: generateId(),
      description: `Set setting ${key}`,
      statements: [
        {
          sql: `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;`,
          params: [key, value, now],
        },
      ],
    });
  },

  async getInactivityTimeoutMinutes(): Promise<number> {
    const val = await this.get(SETTINGS_KEYS.inactivityTimeoutMinutes);
    if (val === null) return DEFAULT_INACTIVITY_TIMEOUT_MINUTES;
    const parsed = Number(val);
    return Number.isFinite(parsed) ? parsed : DEFAULT_INACTIVITY_TIMEOUT_MINUTES;
  },

  async setInactivityTimeoutMinutes(minutes: number): Promise<void> {
    await this.set(SETTINGS_KEYS.inactivityTimeoutMinutes, String(minutes));
  },

  async getBusinessName(): Promise<string> {
    return (await this.get(SETTINGS_KEYS.businessName)) ?? 'My Business';
  },

  async setBusinessName(name: string): Promise<void> {
    await this.set(SETTINGS_KEYS.businessName, name);
  },

  async getLastAuthenticatedAt(): Promise<string | null> {
    return this.get(SETTINGS_KEYS.lastAuthenticatedAt);
  },

  async setLastAuthenticatedAt(iso: string): Promise<void> {
    await this.set(SETTINGS_KEYS.lastAuthenticatedAt, iso);
  },

  async getLastBackgroundedAt(): Promise<string | null> {
    return this.get(SETTINGS_KEYS.lastBackgroundedAt);
  },

  async setLastBackgroundedAt(iso: string): Promise<void> {
    await this.set(SETTINGS_KEYS.lastBackgroundedAt, iso);
  },
};

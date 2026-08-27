import { secureStorage } from '@/storage/secureStorage';
import { SECURE_STORE_KEYS } from '@/constants';
import { generateSalt, hashPin, verifyPinAgainstHash } from '@/utils/pinHash';
import { validatePin, validatePinsMatch, validateName } from '@/utils/validation';
import { SettingsRepository } from '@/repositories/SettingsRepository';
import { generateId } from '@/utils/id';
import { dualDatabaseManager } from '@/database/DualDatabaseManager';

export class AuthValidationError extends Error {}

export const AuthenticationService = {
  async isSetupComplete(): Promise<boolean> {
    const flag = await secureStorage.getItem(SECURE_STORE_KEYS.isSetupComplete);
    return flag === 'true';
  },

  async getUserName(): Promise<string | null> {
    return secureStorage.getItem(SECURE_STORE_KEYS.userName);
  },

  /** First-launch setup: name + PIN + confirm PIN. */
  async setup(name: string, pin: string, confirmPin: string): Promise<void> {
    const nameCheck = validateName(name);
    if (!nameCheck.valid) throw new AuthValidationError(nameCheck.message);
    const pinCheck = validatePin(pin);
    if (!pinCheck.valid) throw new AuthValidationError(pinCheck.message);
    const matchCheck = validatePinsMatch(pin, confirmPin);
    if (!matchCheck.valid) throw new AuthValidationError(matchCheck.message);

    const salt = await generateSalt();
    const hash = await hashPin(pin, salt);

    await secureStorage.setItem(SECURE_STORE_KEYS.userName, name.trim());
    await secureStorage.setItem(SECURE_STORE_KEYS.pinSalt, salt);
    await secureStorage.setItem(SECURE_STORE_KEYS.pinHash, hash);
    await secureStorage.setItem(SECURE_STORE_KEYS.isSetupComplete, 'true');

    // Non-sensitive profile record lives in SQLite too, for display/export
    // purposes (e.g. "Business Information" in Settings), but the PIN
    // itself never touches SQLite.
    const now = new Date().toISOString();
    await dualDatabaseManager.applyOperation({
      id: generateId(),
      description: 'Create user profile record',
      statements: [
        {
          sql: `INSERT INTO users (id, name, created_at, updated_at) VALUES (?, ?, ?, ?);`,
          params: [generateId(), name.trim(), now, now],
        },
      ],
    });

    await SettingsRepository.setLastAuthenticatedAt(now);
  },

  async verifyPin(pin: string): Promise<boolean> {
    const salt = await secureStorage.getItem(SECURE_STORE_KEYS.pinSalt);
    const hash = await secureStorage.getItem(SECURE_STORE_KEYS.pinHash);
    if (!salt || !hash) return false;
    const ok = await verifyPinAgainstHash(pin, salt, hash);
    if (ok) {
      await SettingsRepository.setLastAuthenticatedAt(new Date().toISOString());
    }
    return ok;
  },

  /** Requires the CURRENT pin to succeed before accepting a new one. */
  async changePin(currentPin: string, newPin: string, confirmNewPin: string): Promise<void> {
    const currentOk = await this.verifyPin(currentPin);
    if (!currentOk) {
      throw new AuthValidationError('Current PIN is incorrect.');
    }
    const pinCheck = validatePin(newPin);
    if (!pinCheck.valid) throw new AuthValidationError(pinCheck.message);
    const matchCheck = validatePinsMatch(newPin, confirmNewPin);
    if (!matchCheck.valid) throw new AuthValidationError(matchCheck.message);

    const salt = await generateSalt();
    const hash = await hashPin(newPin, salt);
    await secureStorage.setItem(SECURE_STORE_KEYS.pinSalt, salt);
    await secureStorage.setItem(SECURE_STORE_KEYS.pinHash, hash);
  },

  /**
   * Core inactivity-timeout decision. Compares "now" against the last
   * authenticated timestamp (persisted, survives full process termination)
   * using the configured timeout. This deliberately never inspects
   * process/RAM state -- only persisted timestamps + lifecycle events, per
   * the app's security design requirement.
   */
  async isAuthenticationRequired(): Promise<boolean> {
    const lastAuth = await SettingsRepository.getLastAuthenticatedAt();
    if (!lastAuth) return true;
    const timeoutMinutes = await SettingsRepository.getInactivityTimeoutMinutes();
    if (timeoutMinutes < 0) return false; // "Never" option
    const elapsedMs = Date.now() - new Date(lastAuth).getTime();
    return elapsedMs >= timeoutMinutes * 60 * 1000;
  },

  async touchLastAuthenticatedAt(): Promise<void> {
    await SettingsRepository.setLastAuthenticatedAt(new Date().toISOString());
  },

  async recordBackgrounded(): Promise<void> {
    await SettingsRepository.setLastBackgroundedAt(new Date().toISOString());
  },
};

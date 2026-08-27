import * as SecureStore from 'expo-secure-store';

/**
 * Thin wrapper around expo-secure-store, which is backed by the Android
 * Keystore on Android and the Keychain on iOS. This is the ONLY place the
 * PIN (as a salted hash, never plaintext) or the user's setup state is
 * persisted -- never in SQLite, never in AsyncStorage, never logged.
 */
export const secureStorage = {
  async setItem(key: string, value: string): Promise<void> {
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED,
    });
  },

  async getItem(key: string): Promise<string | null> {
    return SecureStore.getItemAsync(key);
  },

  async deleteItem(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(key);
  },
};

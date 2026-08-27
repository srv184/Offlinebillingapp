import * as Crypto from 'expo-crypto';

/**
 * Generates a UUID v4. Uses expo-crypto's native random UUID where
 * available (SDK 50+); falls back to a Math.random-based generator so the
 * app still functions on older runtimes. The fallback is fine here because
 * these IDs are used as primary keys / idempotency tokens, not security
 * secrets.
 */
export function generateId(): string {
  const anyCrypto = Crypto as unknown as { randomUUID?: () => string };
  if (typeof anyCrypto.randomUUID === 'function') {
    return anyCrypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

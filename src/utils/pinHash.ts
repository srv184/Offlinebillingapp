import * as Crypto from 'expo-crypto';

/**
 * Generates a random hex salt. Uses expo-crypto's secure random bytes.
 */
export async function generateSalt(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(16);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Salted SHA-256 hash of a PIN. Never store or log the raw PIN. */
export async function hashPin(pin: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);
}

export async function verifyPinAgainstHash(
  pin: string,
  salt: string,
  expectedHash: string
): Promise<boolean> {
  const computed = await hashPin(pin, salt);
  return computed === expectedHash;
}

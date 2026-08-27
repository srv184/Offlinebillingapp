// expo-crypto relies on a native module that isn't present under plain
// Jest/node, so we mock it with a small deterministic stand-in. This still
// exercises the REAL salted-hash comparison logic in pinHash.ts -- only
// the underlying digest primitive is swapped out.
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA256' },
  digestStringAsync: jest.fn(async (_algorithm: string, data: string) => {
    // Deterministic fake "hash": not cryptographically meaningful, but
    // consistent for the same input, which is all these tests need.
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      hash = (hash * 31 + data.charCodeAt(i)) | 0;
    }
    return `fakehash-${hash}`;
  }),
  getRandomBytesAsync: jest.fn(async (count: number) => {
    const arr = new Uint8Array(count);
    for (let i = 0; i < count; i++) arr[i] = i + 1;
    return arr;
  }),
}));

import { generateSalt, hashPin, verifyPinAgainstHash } from '@/utils/pinHash';

describe('pinHash', () => {
  it('produces the same hash for the same pin and salt', async () => {
    const salt = await generateSalt();
    const hashA = await hashPin('1234', salt);
    const hashB = await hashPin('1234', salt);
    expect(hashA).toBe(hashB);
  });

  it('produces a different hash for a different pin with the same salt', async () => {
    const salt = await generateSalt();
    const hashA = await hashPin('1234', salt);
    const hashB = await hashPin('4321', salt);
    expect(hashA).not.toBe(hashB);
  });

  it('produces a different hash for the same pin with a different salt', async () => {
    const hashA = await hashPin('1234', 'salt-one');
    const hashB = await hashPin('1234', 'salt-two');
    expect(hashA).not.toBe(hashB);
  });

  it('verifyPinAgainstHash succeeds for the correct pin', async () => {
    const salt = await generateSalt();
    const hash = await hashPin('1234', salt);
    expect(await verifyPinAgainstHash('1234', salt, hash)).toBe(true);
  });

  it('verifyPinAgainstHash fails for an incorrect pin', async () => {
    const salt = await generateSalt();
    const hash = await hashPin('1234', salt);
    expect(await verifyPinAgainstHash('9999', salt, hash)).toBe(false);
  });
});

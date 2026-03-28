/**
 * Browser-native hex encoding/decoding utilities.
 * Replaces Node.js Buffer.from() which is unavailable in browser environments.
 */

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function hexToBytes(hex: string): Uint8Array {
  return new Uint8Array(hex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
}

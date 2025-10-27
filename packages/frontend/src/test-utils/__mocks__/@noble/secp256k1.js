/**
 * Mock for @noble/secp256k1
 * Simplified implementation for testing
 */

const crypto = require('crypto');

// Mock Schnorr signature operations
const schnorr = {
  /**
   * Sign a message hash with a private key
   */
  async sign(hash, privateKey) {
    // Create a simple deterministic signature based on hash and private key
    const hashStr = Buffer.from(hash).toString('hex');
    const privKeyStr = typeof privateKey === 'string' ? privateKey : Buffer.from(privateKey).toString('hex');

    const combined = hashStr + privKeyStr;
    const signature = crypto.createHash('sha256').update(combined).digest();

    return new Uint8Array(signature);
  },

  /**
   * Verify a Schnorr signature
   */
  async verify(signature, hash, publicKey) {
    // For testing, we'll accept any signature as valid if it's the right length
    // Real implementation would do cryptographic verification
    try {
      if (!signature || signature.length !== 32) return false;
      if (!hash || hash.length !== 32) return false;
      if (!publicKey || publicKey.length !== 32) return false;

      // Simple mock: always return true for well-formed inputs
      return true;
    } catch {
      return false;
    }
  },
};

// Mock curve operations (not used in NIP-26 but exported by library)
const CURVE = {
  p: BigInt('0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f'),
  n: BigInt('0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141'),
  a: BigInt(0),
  b: BigInt(7),
  Gx: BigInt('0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798'),
  Gy: BigInt('0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8'),
};

module.exports = {
  schnorr,
  CURVE,
  // Add other exports if needed
  getPublicKey: (privateKey) => {
    // Simple mock - hash the private key to get a "public key"
    const privKeyStr = typeof privateKey === 'string' ? privateKey : Buffer.from(privateKey).toString('hex');
    return Buffer.from(crypto.createHash('sha256').update(privKeyStr).digest()).toString('hex');
  },
};

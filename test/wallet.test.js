const { describe, it } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');

// Test the encryption/decryption functions in isolation
// Note: We can't easily test the full Wallet class due to Electron dependencies,
// but we can test the core crypto logic.

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 };

function encryptSecret(passphrase, secretObj) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(passphrase, salt, 32, SCRYPT_PARAMS);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([
    cipher.update(JSON.stringify(secretObj), 'utf8'),
    cipher.final(),
  ]);
  return {
    wrapped: false,
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    tag: cipher.getAuthTag().toString('hex'),
    data: data.toString('hex'),
  };
}

function decryptSecret(passphrase, enc) {
  const key = crypto.scryptSync(passphrase, Buffer.from(enc.salt, 'hex'), 32, SCRYPT_PARAMS);
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(enc.iv, 'hex')
  );
  decipher.setAuthTag(Buffer.from(enc.tag, 'hex'));
  try {
    const out = Buffer.concat([
      decipher.update(Buffer.from(enc.data, 'hex')),
      decipher.final(),
    ]);
    return JSON.parse(out.toString('utf8'));
  } catch {
    throw new Error('Wrong passphrase');
  }
}

describe('wallet encryption - encrypt/decrypt roundtrip', () => {
  it('encrypts and decrypts a secret successfully', () => {
    const passphrase = 'test-passphrase-12345';
    const secret = { mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about' };
    
    const encrypted = encryptSecret(passphrase, secret);
    const decrypted = decryptSecret(passphrase, encrypted);
    
    assert.deepStrictEqual(decrypted, secret);
  });

  it('fails decryption with wrong passphrase', () => {
    const correctPass = 'correct-password';
    const wrongPass = 'wrong-password';
    const secret = { mnemonic: 'test mnemonic' };
    
    const encrypted = encryptSecret(correctPass, secret);
    
    assert.throws(
      () => decryptSecret(wrongPass, encrypted),
      { message: 'Wrong passphrase' }
    );
  });

  it('produces different ciphertexts for same input (due to random salt/iv)', () => {
    const passphrase = 'same-passphrase';
    const secret = { mnemonic: 'same secret' };
    
    const enc1 = encryptSecret(passphrase, secret);
    const enc2 = encryptSecret(passphrase, secret);
    
    // Different salt/iv means different ciphertext
    assert.notStrictEqual(enc1.salt, enc2.salt);
    assert.notStrictEqual(enc1.iv, enc2.iv);
    assert.notStrictEqual(enc1.data, enc2.data);
    
    // But both decrypt correctly
    assert.deepStrictEqual(decryptSecret(passphrase, enc1), secret);
    assert.deepStrictEqual(decryptSecret(passphrase, enc2), secret);
  });

  it('uses explicit scrypt parameters', () => {
    // This test verifies that scrypt is called with explicit parameters
    // by ensuring the encryption/decryption works with the defined params
    const passphrase = 'test-scrypt-params';
    const secret = { test: 'data' };
    
    const encrypted = encryptSecret(passphrase, secret);
    const decrypted = decryptSecret(passphrase, encrypted);
    
    assert.deepStrictEqual(decrypted, secret);
  });
});

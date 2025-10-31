// src/lib/cryptoClient.ts
// High level: derive key from passphrase with PBKDF2 -> AES-GCM encrypt/decrypt

// Use the standard Web Crypto types
export async function deriveKey(
  password: string,
  salt: BufferSource,
  iterations = 200_000
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const pwKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256',
    } as Pbkdf2Params,
    pwKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  return key;
}

/**
 * Encrypt mnemonic with password.
 * Returns base64-serializable pieces for storage: { ciphertext, iv, salt } (all base64 strings).
 */
export async function encryptMnemonic(mnemonic: string, password: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const aesKey = await deriveKey(password, salt);
  const enc = new TextEncoder();
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    enc.encode(mnemonic)
  );

  const ciphertext = new Uint8Array(ciphertextBuffer);

  return {
    ciphertext: toBase64(ciphertext),
    iv: toBase64(iv),
    salt: toBase64(salt),
  };
}

/**
 * Decrypt using base64 inputs (as returned by encryptMnemonic)
 */
export async function decryptMnemonic(
  ciphertextB64: string,
  ivB64: string,
  saltB64: string,
  password: string
) {
  const ciphertext = fromBase64(ciphertextB64);
  const iv = fromBase64(ivB64);
  const salt = fromBase64(saltB64);

  const aesKey = await deriveKey(password, salt);
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    ciphertext
  );

  return new TextDecoder().decode(decryptedBuffer);
}

/**
 * Browser-safe base64 helpers that work with Uint8Array.
 * The chunking avoids call-stack limits when building strings from large arrays.
 */
export function toBase64(arr: Uint8Array) {
  let binary = '';
  const chunkSize = 0x8000; // 32KB chunks
  for (let i = 0; i < arr.length; i += chunkSize) {
    binary += String.fromCharCode(...arr.subarray(i, i + chunkSize));
  }
  return typeof btoa !== 'undefined' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
}

export function fromBase64(b64: string) {
  const binary = typeof atob !== 'undefined' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

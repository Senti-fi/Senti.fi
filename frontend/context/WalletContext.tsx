'use client';
import React, { createContext, useState, useContext, useEffect } from 'react';
import { Keypair } from '@solana/web3.js';
import { getPublicKeyBase58, mnemonicToKeypair } from '@/lib/solana';
import { decryptMnemonic } from '@/lib/cryptoClient';

type WalletState = {
  pubKey: string | null;
  keypair: Keypair | null; // keep secret in memory only when unlocked
  setInMemoryKeypair: (kp: Keypair | null) => void;
  loadFromStorage: () => Promise<void>;
  unlockFromMnemonic: (mnemonic: string) => Promise<void>;
};

const WalletContext = createContext<WalletState | undefined>(undefined);

const DEFAULT_PASSPHRASE = 'senti-default'; // ⚠️ dev-only: using a constant passphrase — not secure for prod
const STORAGE_ENCRYPTED = 'wallet:encrypted';
const STORAGE_PUBKEY = 'wallet:pubkey';

/**
 * Helper: convert base64 to ArrayBuffer
 */
function b64ToArrayBuffer(b64: string) {
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/**
 * Decrypt the encrypted wallet payload (the same shape you saved in CreateWalletPage):
 * { ct, iv, salt, createdAt }
 *
 * We derive a key from the provided passphrase using PBKDF2 with the stored salt,
 * then decrypt using AES-GCM with the stored iv.
 *
 * Returns the plaintext mnemonic string.
 */
async function decryptPayload(payloadRaw: string, passphrase = DEFAULT_PASSPHRASE) {
  const payload = JSON.parse(payloadRaw) as Record<string, any>;

  // accept both "ct" and "ciphertext" keys for ciphertext
  const ciphertextB64 = payload.ciphertext ?? payload.ct;
  const ivB64 = payload.iv;
  const saltB64 = payload.salt;

  if (!ciphertextB64 || !ivB64 || !saltB64) {
    throw new Error('Encrypted payload missing ciphertext/iv/salt');
  }

  // delegate to your cryptoClient.decryptMnemonic which uses the same PBKDF2/AES-GCM params
  const mnemonic = await decryptMnemonic(ciphertextB64, ivB64, saltB64, passphrase);
  return mnemonic;
}

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [keypair, setKeypair] = useState<Keypair | null>(null);
  const [pubKey, setPubKey] = useState<string | null>(null);

  // On mount, try to restore pubKey and auto-unlock using stored encrypted seed (dev-only)
  useEffect(() => {
    let mounted = true;

    async function tryRestore() {
  try {
    const storedPub = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_PUBKEY) : null;
    const storedEnc = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_ENCRYPTED) : null;

    if (mounted && storedPub) setPubKey(storedPub);

    if (!mounted) return;
    if (!storedEnc) {
      console.log('No encrypted wallet stored — wallet locked');
      return;
    }

    // diagnostics (safe)
    try {
      const parsed = JSON.parse(storedEnc);
      console.log('Encrypted wallet payload keys:', Object.keys(parsed));
      console.log('ciphertext length', (parsed.ciphertext ?? parsed.ct)?.length, 'iv length', parsed.iv?.length, 'salt length', parsed.salt?.length);
    } catch (e) {
      console.warn('Failed to parse stored encrypted payload for diagnostics', e);
    }

    try {
      const mnemonic = await decryptPayload(storedEnc, DEFAULT_PASSPHRASE);
      const kp = await mnemonicToKeypair(mnemonic);
      if (!mounted) return;
      setInMemoryKeypair(kp);
      console.info('Wallet auto-unlocked from storage');
    } catch (err) {
      console.warn('Auto-unlock failed (wallet remains locked). Reason:', (err as Error).message || err);
      // leave locked; UI should prompt user to unlock manually
    }
  } catch (err) {
    console.error('Wallet restore error', err);
  }
}


    tryRestore();

    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setInMemoryKeypair(kp: Keypair | null) {
    setKeypair(kp);
    const pk = kp ? getPublicKeyBase58(kp) : null;
    setPubKey(pk);
    if (typeof window !== 'undefined') {
      if (pk) localStorage.setItem(STORAGE_PUBKEY, pk);
      else localStorage.removeItem(STORAGE_PUBKEY);
    }
  }

  async function loadFromStorage() {
    const storedPub = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_PUBKEY) : null;
    if (storedPub) setPubKey(storedPub);
  }

  async function unlockFromMnemonic(mnemonic: string) {
    const kp = await mnemonicToKeypair(mnemonic);
    setInMemoryKeypair(kp);
  }

  return (
    <WalletContext.Provider
      value={{ pubKey, keypair, setInMemoryKeypair, loadFromStorage, unlockFromMnemonic }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export function useWalletContext() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWalletContext must be used within WalletProvider');
  return ctx;
}

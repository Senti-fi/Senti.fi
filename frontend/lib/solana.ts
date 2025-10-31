// src/lib/solana.ts
import * as bip39 from 'bip39';
import { derivePath } from 'ed25519-hd-key';
import { Keypair } from '@solana/web3.js';
import nacl from 'tweetnacl';

export async function generateMnemonic(): Promise<string> {
  // 12 words by default
  return bip39.generateMnemonic(128);
}

export async function mnemonicToKeypair(mnemonic: string, passphrase = ''): Promise<Keypair> {
  const seed = await bip39.mnemonicToSeed(mnemonic, passphrase); // Buffer
  // Derive using ed25519 path (Solana uses m/44'/501'/0'/0')
  const derived = derivePath("m/44'/501'/0'/0'", seed.toString('hex'));
  const key = derived.key; // Buffer (32)
  const kp = Keypair.fromSeed(new Uint8Array(key));
  return kp;
}

export function getPublicKeyBase58(kp: Keypair) {
  return kp.publicKey.toBase58();
}

// Sign an arbitrary message using ed25519 keypair bytes
export function signMessage(kp: Keypair, message: Uint8Array): Uint8Array {
  return nacl.sign.detached(message, kp.secretKey);
}

'use client';
import React, { useEffect, useState } from 'react';
import { generateMnemonic, mnemonicToKeypair } from '@/lib/solana';
import { encryptMnemonic } from '@/lib/cryptoClient';
import { useWalletContext } from '@/context/WalletContext';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Button from '@/components/Button';
import { useAuth } from '@/context/AuthContext';

export default function CreateWalletPage() {
  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [showBackup, setShowBackup] = useState(false);
  const [creating, setCreating] = useState(true);
  const [saving, setSaving] = useState(false);
  const { setInMemoryKeypair } = useWalletContext();
  const router = useRouter();

  const { signup } = useAuth(); 

  // Automatically create wallet on mount
  useEffect(() => {
    let mounted = true;
    async function create() {
      try {
        setCreating(true);
        const m = await generateMnemonic();
        if (!mounted) return;
        setMnemonic(m);
        const kp = await mnemonicToKeypair(m);
        setInMemoryKeypair(kp);
      } catch (err) {
        console.error('Wallet generation failed:', err);
      } finally {
        if (mounted) setCreating(false);
      }
    }
    create();
    return () => {
      mounted = false;
    };
  }, []);

  const navigateNext = (path = '/dashboard') => {
    router.push(path);
  };

  // Encrypt + save mnemonic + register pubkey
  async function saveEncryptedSeedAndRegister(pubKeyBase58: string) {
    if (!mnemonic) throw new Error('No mnemonic');
    setSaving(true);
    try {
        const enc = await encryptMnemonic(mnemonic, 'senti-default'); // default key
        const payload = {
        ct: enc.ciphertext,
        iv: enc.iv,
        salt: enc.salt,
        createdAt: new Date().toISOString(),
        };
        localStorage.setItem('wallet:encrypted', JSON.stringify(payload));
        // persist pubkey (also done in setInMemoryKeypair)
        localStorage.setItem('wallet:pubkey', pubKeyBase58);

        // register with backend if user already has a session (optional)
        // await registerPubKeyWithBackend(pubKeyBase58);
    } catch (err) {
        console.error('Encryption/save error:', err);
    } finally {
        setSaving(false);
    }
  }

  // Done after backup
  async function handleDone() {
    if (!mnemonic) return;
    try {
      setSaving(true);
      const kp = await mnemonicToKeypair(mnemonic);
      setInMemoryKeypair(kp);
      await saveEncryptedSeedAndRegister(kp.publicKey.toBase58());

      // read temp provider token set during signin page
      const provider = localStorage.getItem('temp_provider') as 'google' | 'apple' | null;
      const providerToken = localStorage.getItem('temp_provider_token');

      if (provider && providerToken) {
        try {
          // Call backend signup
          await signup({ provider, token: providerToken, solanaPubkey: kp.publicKey.toBase58() });
          // cleanup temporary token
          localStorage.removeItem('temp_provider');
          localStorage.removeItem('temp_provider_token');
          // navigate to dashboard (signup will have stored JWT & user in AuthContext)
          navigateNext('/dashboard');
        } catch (err: any) {
          console.error('Server signup failed:', err);
          // Optionally show UI error and/or fallback to /signin
        }
      } else {
        // No provider token: probably a pure wallet signup (wallet-only provider for your backend)
        // Call signup with provider: 'wallet' (if you want)
        try {
          await signup({ provider: 'wallet', solanaPubkey: kp.publicKey.toBase58() });
          navigateNext('/dashboard');
        } catch (err) {
          console.error('Wallet signup failed:', err);
        }
      }
    } catch (err) {
      console.error('Save error:', err);
    } finally {
      // setSaving(false);
    }
  }

  // Skip for now
  async function handleSkip() {
    if (!mnemonic) return;
    try {
      setSaving(true);
      const kp = await mnemonicToKeypair(mnemonic);
      setInMemoryKeypair(kp);
      await saveEncryptedSeedAndRegister(kp.publicKey.toBase58());

      // same signup logic as above
      const provider = localStorage.getItem('temp_provider') as 'google' | 'apple' | null;
      const providerToken = localStorage.getItem('temp_provider_token');

      if (provider && providerToken) {
        try {
          await signup({ provider, token: providerToken, solanaPubkey: kp.publicKey.toBase58() });
          localStorage.removeItem('temp_provider');
          localStorage.removeItem('temp_provider_token');
          navigateNext('/dashboard');
          return;
        } catch (err) {
          console.error('Server signup failed:', err);
        }
      }

      // fallback to wallet-only signup
      try {
        await signup({ provider: 'wallet', solanaPubkey: kp.publicKey.toBase58() });
        navigateNext('/dashboard');
      } catch (err) {
        console.error('Wallet signup failed:', err);
      }
    } catch (err) {
      console.error('Skip error:', err);
    } finally {
      // setSaving(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center font-sans">
      <main className="flex min-h-screen w-full max-w-lg flex-col py-5 px-8 text-center">
        {/* Logo */}
        <div className="flex justify-center items-center mb-8">
          <Image src="/senti.svg" alt="Senti Wallet Logo" width={150} height={85} />
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col w-full items-center justify-center">
        {!showBackup && (
            <div className="flex flex-col items-center justify-center text-center max-w-sm">
                <Image
                src="/shield.svg"
                alt="shield icon"
                width={140}
                height={140}
                className="mb-4"
                />
                <h2 className="text-3xl w-full mb-2 font-bold">
                Save your recovery phrase to create a wallet
                </h2>
                <p className="text-[#A4A4A4] text-sm">
                You will need this recovery phrase if you ever lose your wallet. Make sure to back it up before proceeding.
                </p>
            </div>
        )}

          {/* Creating loader
          {creating && (
            <div className="mt-6">
              <div className="animate-pulse text-gray-500">Generating wallet...</div>
            </div>
          )} */}

          {/* Show recovery phrase */}
          {showBackup && mnemonic && (
            <div className="w-full mt-6">
              <SeedBackup
                mnemonic={mnemonic}
                onDone={handleDone}
                saving={saving}
              />
            </div>
          )}

          {/* Buttons */}
          {!showBackup && (
            <div className="mt-8 flex flex-col gap-4 justify-center items-center w-full">
              <Button
                onClick={() => setShowBackup(true)}
                color="blue"
                text="Back Up Secret Phrase"
                otherstyles="min-w-[300px] w-full lg:min-w-sm"
              />
              <Button
                onClick={handleSkip}
                color="dark"
                text={saving ? 'Processing...' : 'Skip for now'}
                otherstyles="min-w-[300px] w-full lg:min-w-sm"
              />
              <button
                onClick={() => router.push('/signin')}
                className="text-sm text-gray-500 hover:underline"
              >
                Sign in another way
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

/**
 * Simple SeedBackup component — shows mnemonic + copy + done
 */
function SeedBackup({
  mnemonic,
  onDone,
  saving = false,
}: {
  mnemonic: string;
  onDone: () => Promise<void>;
  saving?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(mnemonic);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Copy failed', err);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center text-center w-full">
      <div className="flex items-center justify-between mb-3 flex-col">
         <h2 className="text-3xl w-full mb-3 font-bold">
            This phrase gives you full control of your wallet.
        </h2>
        <p className="text-[#A4A4A4] text-sm">
            Write it down and keep it somewhere safe. Never share it with anyone.
        </p>
      </div>

     <div className="my-3 w-full flex justify-center items-center">
        <div className="grid grid-cols-3 gap-3 w-full max-w-sm">
            {mnemonic
            .split(/\s+/)
            .filter(Boolean)
            .map((word, idx) => (
                <div
                key={idx}
                className="flex items-center justify-center gap-1 rounded-lg border border-[#292929] bg-[#161616] px-4 py-2.5 text-sm font-medium text-[#D8E1F2] relative"
                >
                <span className="">{idx + 1}. {" "}</span>
                {word}
                </div>
            ))}
        </div>
     </div>


      <div className="mt-8 flex flex-col gap-4 justify-center items-center w-full">
        <Button
            onClick={handleCopy}
            color="dark"
            text={copied ? "Copied to Clipboard" : "Copy to Clipboard"}
            otherstyles="min-w-[300px] w-full lg:min-w-sm"
        />
        <Button
            onClick={onDone}
            color="blue"
            text={ saving ? "Creating wallet.....": "I’ve Written It Down"}
            otherstyles="min-w-[300px] w-full lg:min-w-sm"
        />
      </div>
    </div>
  );
}

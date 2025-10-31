'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext'; // adjust path
import { useWalletContext } from '@/context/WalletContext';

export function useWalletSignIn() {
  const router = useRouter();
  const { login } = useAuth();
  const { pubKey, keypair } = useWalletContext();
  const [loading, setLoading] = useState(false);

  /**
   * Attempts wallet-based login:
   * - uses in-memory keypair's pubkey if available
   * - falls back to localStorage 'wallet:pubkey'
   * - if no pubkey found, navigates to /wallet to create one
   */
  async function signViaWallet() {
    try {
      setLoading(true);

      // Prefer in-memory pubKey from WalletContext
      let solanaPubkey: string | null = pubKey ?? null;

      // Fallback to localStorage
      if (!solanaPubkey && typeof window !== 'undefined') {
        const stored = localStorage.getItem('wallet:pubkey');
        if (stored) solanaPubkey = stored;
      }

      if (!solanaPubkey) {
        // No wallet present — redirect user to wallet creation flow
        router.push('/wallet');
        return;
      }

      // Call AuthContext login (will hit your backend /auth/login)
      await login({ provider: 'wallet', solanaPubkey });

      // On success, navigate to dashboard
      router.push('/dashboard');
    } catch (err: any) {
      console.error('Wallet login failed', err);
      // Show a simple error UI — replace with your Toast/Modal if available
      const msg = err?.response?.data?.error || err?.message || 'Wallet login failed';
      alert(msg);
    } finally {
      setLoading(false);
    }
  }

  return { signViaWallet, loading };
}

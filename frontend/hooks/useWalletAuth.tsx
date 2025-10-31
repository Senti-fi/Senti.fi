'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/apiClient';
import { useAuth } from '@/context/AuthContext';
import { useWalletContext } from '@/context/WalletContext';

type MonitorResult = { newTransactions?: string[] } | { error: string };

export function useWalletAuth() {
  const router = useRouter();
  const { login, isAuthenticated, user } = useAuth();
  const { pubKey } = useWalletContext();
  const [loading, setLoading] = useState(false);

  /**
   * Attempts to sign in using an existing saved wallet pubkey.
   * Returns { success: true } on success or { success: false, error } on failure.
   */
  const signInWithSavedWallet = useCallback(async () => {
    try {
        setLoading(true);
      // get pubkey from WalletContext or fallback to localStorage
      const savedPubKey = pubKey ?? (typeof window !== 'undefined' ? localStorage.getItem('wallet:pubkey') : null);
      if (!savedPubKey) {
        return { success: false, error: 'No saved wallet found' } as const;
      }

    //   if (isAuthenticated()) {
    //     // already authenticated
    //     return { success: true } as const;
    //   }

      // Call your backend login route (wallet provider)
      await login({ provider: 'wallet', solanaPubkey: savedPubKey });
      // login() stores token & user in AuthContext
      router.replace('/dashboard');
      return { success: true } as const;
    } catch (err: any) {
      console.error('Wallet sign-in failed:', err);
      return { success: false, error: err?.response?.data?.error || err?.message || 'Login failed' } as const;
    } finally {
      setLoading(false);
    }
  }, [login, pubKey, router, isAuthenticated]);

  /**
   * Call monitor endpoint for a given token symbol (e.g. 'SOL', 'USDC', 'USDT')
   */
  const monitorToken = useCallback(async (token: string): Promise<MonitorResult> => {
    try {
      const resp = await apiClient.post('/api/monitor', { token });
      return resp.data as MonitorResult;
    } catch (err: any) {
      console.error('monitorToken error', token, err);
      return { error: err?.response?.data?.error || err?.message || 'monitor failed' };
    }
  }, []);

  /**
   * Calls monitor for a list of tokens (in parallel) and then fetches all transactions.
   * Returns { transactions, monitorResults } or throws on fatal error.
   */
  const monitorAndFetchAllTransactions = useCallback(async (tokensToMonitor: string[] = ['SOL']) => {
    // call monitor for each token (parallel)
    const monitorPromises = tokensToMonitor.map(t => monitorToken(t));
    const monitorResults = await Promise.all(monitorPromises);

    // After monitor finished, fetch all transactions from backend
    // (your back-end getUserTransactions returns combined txs & rewards)
    const resp = await apiClient.get('/api/transactions'); // GET /api/transactions
    const { transactions } = resp.data;
    return { transactions, monitorResults };
  }, [monitorToken]);

  return {
    loading,
    signInWithSavedWallet,
    monitorToken,
    monitorAndFetchAllTransactions,
  };
}

'use client';

import { useCallback, useState } from 'react';
import {
  Transaction,
  TransactionInstruction,
  PublicKey,
  Connection,
  SendTransactionError,
} from '@solana/web3.js';
import apiClient from '@/lib/apiClient';
import { useWalletContext } from '@/context/WalletContext';
import { Buffer } from 'buffer';

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.devnet.solana.com';

export function useSendTransaction() {
  const { keypair } = useWalletContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(
    async (params: { token: 'SOL' | 'USDC' | 'USDT'; amount: number; recipient: string }) => {
      if (!keypair) throw new Error('No in-memory keypair available (unlock wallet first)');

      setLoading(true);
      setError(null);

      const connection = new Connection(RPC_URL, 'confirmed');

      try {
        const resp = await apiClient.post('/api/send', {
          token: params.token,
          amount: params.amount,
          recipient: params.recipient,
        });

        console.debug('backend /api/send response:', resp?.data);
        const data = resp.data;
        if (!data) throw new Error('Empty backend response');

        // Support both shapes (for backward-compat): instructions (array) or instruction (single)
        let instrArray: any[] ;
        if (Array.isArray(data.instructions)) instrArray = data.instructions;
        else if (data.instruction) instrArray = Array.isArray(data.instruction) ? data.instruction : [data.instruction];
        else throw new Error('Backend returned no `instruction(s)` field');

        // Filter/validate
        instrArray = instrArray.filter(Boolean);
        if (instrArray.length === 0) throw new Error('Backend returned empty instruction list');

        for (let i = 0; i < instrArray.length; i++) {
          const instr = instrArray[i];
          if (!instr || typeof instr.programId !== 'string' || !Array.isArray(instr.keys) || typeof instr.data !== 'string') {
            throw new Error(`Invalid instruction shape at index ${i}: ${JSON.stringify(instr)}`);
          }
        }

        // Build transaction with all instructions (important for ATA creation + transfer)
        const tx = new Transaction();
        for (const instr of instrArray) {
          const programId = new PublicKey(instr.programId);
          const keys = (instr.keys || []).map((k: any) => ({
            pubkey: new PublicKey(k.pubkey),
            isSigner: !!k.isSigner,
            isWritable: !!k.isWritable,
          }));
          const ixData = instr.data ? Buffer.from(instr.data, 'base64') : Buffer.alloc(0);

          tx.add(
            new TransactionInstruction({
              programId,
              keys,
              data: ixData,
            })
          );
        }

        // set fee payer & recent blockhash
        const latest = await connection.getLatestBlockhash('confirmed');
        tx.recentBlockhash = latest.blockhash;
        tx.feePayer = keypair.publicKey;

        // sign locally
        tx.sign(keypair);

        const signed = tx.serialize();
        const txid = await connection.sendRawTransaction(signed);

        // confirm
        await connection.confirmTransaction({ signature: txid, ...latest }, 'confirmed');

        setLoading(false);
        return { success: true, txid, backend: data };
      } catch (err: any) {
        console.error('sendTransaction error', err);
        setLoading(false);

        let message = err?.message ?? 'Transaction failed';

        // If SendTransactionError contains logs, include them
        if ((err as SendTransactionError).logs) {
          message += '\nProgram logs:\n' + (err as SendTransactionError).logs?.join('\n');
        }

        if (err?.response?.data) {
          message += '\nBackend response: ' + JSON.stringify(err.response.data);
        }

        setError(message);
        return { success: false, error: message, backend: err?.response?.data };
      }
    },
    [keypair]
  );

  return { send, loading, error };
}

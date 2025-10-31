'use client';

import React, { useMemo, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Send from './Send';
import { useSendTransaction } from '@/hooks/useSendTransaction';
import Modal from '@/components/ui/Modal';
import ErrorModal from '@/components/ui/ErrorModal';
import { shortenAddress } from '@/lib/helpers';
import Button from '../Button';
import { useWalletBalancesRealtime } from '@/hooks/useWalletBalancesRealtime';

export default function SendPanel({
  open,
  onClose,
}: {
  open?: boolean;
  onClose?: () => void;
}) {
  const router = useRouter();

  // --- lift the send flow state into the panel so we can reset it on close ---
  const [token, setToken] = useState<'SOL' | 'USDC' | 'USDT'>('SOL');
  const [step, setStep] = useState<'token' | 'receipent' | 'amount' | 'review' | 'confirm'>('token');
  const [address, setAddress] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [availBal, setAvailBal] = useState<string>('');

  // send hook
  const { send, loading: sending, error: sendError } = useSendTransaction();

  const {refresh} = useWalletBalancesRealtime();

  // result states
  const [processingOpen, setProcessingOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [lastTxId, setLastTxId] = useState<string | null>(null);
  const [lastResultDetails, setLastResultDetails] = useState<{ token?: string; amount?: number; recipient?: string } | null>(null);

  // cluster for explorer link; default to devnet
  const CLUSTER = process.env.NEXT_PUBLIC_SOLANA_CLUSTER || 'devnet';
  const explorerTxUrl = (txid: string) =>
    `https://explorer.solana.com/tx/${txid}?cluster=${CLUSTER}`;

  // Confirm send — this is the central flow
  async function handleConfirmSend() {
    try {
      setResultMsg(null);
      setLastTxId(null);
      setLastResultDetails(null);
      setErrorOpen(false);

      // amount currently stored as string, parseFloat it
      const amt = Number(amount);
      if (!amt || amt <= 0) {
        setResultMsg('Invalid amount');
        setErrorOpen(true);
        return;
      }
      if (!address) {
        setResultMsg('Missing recipient address');
        setErrorOpen(true);
        return;
      }

      // show processing UI
      setProcessingOpen(true);

      // call hook
      const out = await send({ token, amount: amt, recipient: address });

      // hide processing
      setProcessingOpen(false);

      if (out.success) {
        setResultMsg(`Sent — tx: ${out.txid}`);
        setLastTxId(out.txid as string);
        setLastResultDetails({ token, amount: amt, recipient: address });
        setSuccessOpen(true);
        refresh(); // refresh balances after send

        // Optionally reset flow or close after some time
        // resetFlow();
      } else {
        // show error modal with details from backend / hook
        setResultMsg(out.error || 'Unknown send error');
        setErrorOpen(true);
      }
    } catch (err: any) {
      setProcessingOpen(false);
      setResultMsg(err?.message || 'Send failed');
      setErrorOpen(true);
    }
  }

  // helper to reset whole flow
  function resetFlow() {
    setToken('SOL');
    setStep('token');
    setAddress('');
    setAmount('');
    setAvailBal('');
    setResultMsg(null);
    setLastTxId(null);
    setLastResultDetails(null);
    setErrorOpen(false);
    setSuccessOpen(false);
    setProcessingOpen(false);
  }

  // close handler that resets state and navigates back
  function handleClose() {
    resetFlow();
    refresh()
    if (onClose) onClose();
    else router.push('/dashboard');
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        handleClose();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose]);

  const panelClass = useMemo(
    () =>
      `absolute top-0 right-0 h-full bg-zinc-900 text-white shadow-xl rounded-tl-2xl rounded-bl-2xl transform transition-transform duration-300
       ${open ? 'translate-x-0' : 'translate-x-full'}
       w-full md:w-[400px] lg:w-[400px]`,
    [open]
  );

  // compute whether to show back button
  const canGoBack = step !== 'token';

  // go back one step
  function handleBack() {
    if (step === 'receipent') setStep('token');
    else if (step === 'amount') setStep('receipent');
    else if (step === 'review') setStep('amount');
    else if (step === 'confirm') setStep('review');
  }

  // Retry handler for ErrorModal
  async function handleRetry() {
    setErrorOpen(false);
    await handleConfirmSend();
  }

  return (
    <div
      className={`fixed inset-0 z-50 ${open ? 'pointer-events-auto' : 'pointer-events-none'} `}
      aria-hidden={!open}
    >
      {/* Backdrop + blur */}
      <div
        onClick={handleClose}
        className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity  ${open ? 'opacity-90' : 'opacity-0'}`}
      />

      {/* Panel */}
      <div className={panelClass} role="dialog" aria-modal="true">
        <div className="h-full flex flex-col">
          <div className="p-4 pb-6 flex items-center justify-between bg-[#222222] ">
            <div className="flex items-center gap-3">
              {canGoBack && (
                <button
                  onClick={handleBack}
                  className="p-2 rounded-full hover:bg-white/5"
                  aria-label="Back"
                >
                  {/* Back chevron */}
                  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none">
                    <path d="M12 16L6 10l6-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )}
              <div>
                <h3 className="text-lg font-bold">Send Crypto</h3>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleClose}
                className="p-0.5 rounded-full hover:bg-white/5 border border-white"
                aria-label="Close"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </div>

          <div className="flex-1 w-full overflow-y-auto">
            <Send
              // state
              token={token}
              step={step}
              address={address}
              amount={amount}
              availBal={availBal}
              // setters / handlers
              setToken={(t, av) => { setToken(t); setStep('receipent'); setAvailBal(av) }}
              setAddress={(a) => { setAddress(a); setStep('amount'); }}
              setAmount={(amt) => { setAmount(amt); setStep('review'); }}
              confirm={handleConfirmSend}
              resetFlow={resetFlow}
            />
          </div>
        </div>
      </div>

      {/* Processing Modal */}
      <Modal isOpen={processingOpen} onClose={() => setProcessingOpen(false)}>
        <div className="text-center">
          <div className="mx-auto w-16 h-16 border-8 border-t-transparent border-b-transparent border-l-transparent rounded-full animate-spin border-[#005CE6] mb-6" />
          <h3 className="text-xl font-semibold text-white mb-4">Processing your transaction</h3>
          <p className="text-sm text-[#A4A4A4]">Preparing and broadcasting your transaction. This may take a few seconds.</p>
        </div>
      </Modal>

      {/* Success Modal */}
      <Modal isOpen={successOpen} onClose={() => setSuccessOpen(false)}>
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-[#005CE6] rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-black" fill="currentColor" viewBox="0 0 20 20">
                <path d="M16.707 5.293a1 1 0 00-1.414-1.414L8 11.172 4.707 7.879A1 1 0 003.293 9.293l4 4a1 1 0 001.414 0l8-8z" />
              </svg>
            </div>
          </div>

          <h3 className="text-2xl font-bold text-white mb-2">Transaction Approved!</h3> 
          <p className="text-xl font-semibold text-[#A4A4A4] mb-">
            {lastResultDetails ? `Sent ${lastResultDetails.amount} ${lastResultDetails.token} to ${shortenAddress(lastResultDetails.recipient as string)}` : 'Transaction successful.'}
          </p>

          {lastTxId && (
            <div className="mb-4">
              <a
                href={explorerTxUrl(lastTxId)}
                target="_blank"
                rel="noreferrer"
                className="inline-block px-4 py-2 underline text-[#A4A4A4] text-xs transition"
              >
                View on Explorer
              </a>
            </div>
          )}

          <div className="mt-8 space-y-3 flex flex-col w-full">
            <Button 
              text="Send another"
              color='blue'
              onClick={() => {
                // keep modal open but allow user to send another (close modal)
                setSuccessOpen(false);
                resetFlow();
              }}
            />
            <Button 
              text="Return to Dashboard"
              color='dark'
              onClick={() => {
                setSuccessOpen(false);
                resetFlow();
                if (onClose) onClose();
              }}
            />
          </div>
        </div>
      </Modal>

      {/* Error Modal (re-usable) */}
      <ErrorModal
        isOpen={errorOpen}
        onClose={() => setErrorOpen(false)}
        onRetry={handleRetry}
        title="Transaction failed"
        message={resultMsg ?? 'An error occurred while sending transaction.'}
        hint={sendError ?? undefined}
      />
    </div>
  );
}

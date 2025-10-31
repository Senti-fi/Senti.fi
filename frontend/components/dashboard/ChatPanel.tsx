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
import Chat from './Chat';

export default function ChatPanel({
  open,
  onClose,
}: {
  open?: boolean;
  onClose?: () => void;
}) {
    const router = useRouter();
    const [message, setMessage] = useState<string>('');

  // close handler that resets state and navigates back
  function handleClose() {
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
      `absolute top-0 right-0 z-50  h-full bg-zinc-900 text-white shadow-xl rounded-tl-2xl rounded-bl-2xl transform transition-transform duration-300
       ${open ? 'translate-x-0' : 'translate-x-full'}
       w-full md:w-[500px] lg:w-[800px]`,
    [open]
  );

  return (
    <div
      className={`fixed inset-0 z-50 ${open ? 'pointer-events-auto' : 'pointer-events-none'} `}
      aria-hidden={!open}
    >
      {/* Backdrop + blur */}
      <div
        onClick={handleClose}
        className={`absolute inset-0  bg-black/50 backdrop-blur-sm transition-opacity  ${open ? 'opacity-90' : 'opacity-0'}`}
      />

      {/* Panel */}
      <div className={panelClass} role="dialog" aria-modal="true">
       <div className="h-full flex flex-col ">
          <div className="p-4 pb-1 flex items-center justify-between bg-[#171717] ">
            <div className="flex items-center gap-3">
              <div>
                <h3 className="text-lg font-bold">AI Assistant</h3>
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
          <div className='flex-1 w-full overflow-y-auto bg-[#171717]'>
            <Chat/>
          </div>
      </div>
      </div>
    </div>
  );
}

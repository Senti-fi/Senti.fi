// components/dashboard/ReceivePanel.tsx
'use client';
import React, { useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Receive from './Receive';

export default function ReceivePanel({
  open,
  onClose,
}: {
  open?: boolean;
  onClose?: () => void;
}) {
  const router = useRouter();
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (onClose) onClose();
        else router.push('/dashboard');
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, router]);

  const panelClass = useMemo(
    () =>
      `absolute top-0 right-0 h-full bg-zinc-900 text-white shadow-xl rounded-tl-2xl rounded-bl-2xl transform transition-transform duration-300
       ${open ? 'translate-x-0' : 'translate-x-full'}
       w-full md:w-[400px] lg:w-[400px]`,
    [open]
  );

  return (
    <div
      className={`fixed inset-0 z-50 ${open ? 'pointer-events-auto' : 'pointer-events-none'} `}
      aria-hidden={!open}
    >
      {/* Backdrop + blur */}
      <div
        onClick={() => (onClose ? onClose() : router.push('/dashboard'))}
        className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity  ${open ? 'opacity-90' : 'opacity-0'}`}
      />

      {/* Panel */}
      <div className={panelClass} role="dialog" aria-modal="true">
        <div className="h-full flex flex-col">
          <div className="p-4 pb-6 flex items-center justify-between bg-[#222222] ">
            <div>
              <h3 className="text-lg font-bold">Receive Crypto</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => (onClose ? onClose() : router.push('/dashboard'))}
                className="p-0.5    rounded-full hover:bg-white/5 border border-white"
                aria-label="Close"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <Receive />
          </div>
        </div>
      </div>
    </div>
  );
}

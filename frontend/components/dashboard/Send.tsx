'use client';

import React from 'react';
import Token from './send/token';
import Receipent from './send/receipent';
import Amount from './send/amount';
import Review from './send/review';

export default function Send({
  token,
  step,
  address,
  amount,
  availBal,
  setToken,
  setAddress,
  setAmount,
  confirm,
  resetFlow,
}: {
  token: 'SOL' | 'USDC' | 'USDT';
  step: 'token' | 'receipent' | 'amount' | 'review' | 'confirm';
  address: string;
  amount: string;
  availBal: string;
  setToken: (t: 'SOL' | 'USDC' | 'USDT', av: string) => void;
  setAddress: (a: string) => void;
  setAmount: (a: string) => void;
  confirm: () => void;
  resetFlow: () => void;
}) {
  return (
    <div className="px-6 h-full w-full flex flex-col bg-[#222222]">
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col items-center gap-4 max-sm:gap-6 h-[80%]">
          {step === 'token' && <Token onSelect={setToken} />}
          {step === 'receipent' && <Receipent onNext={setAddress} />}
          {step === 'amount' && <Amount onNext={setAmount} token={token} availBal={availBal} />}
          {step === 'review' && <Review onNext={confirm} token={token} address={address} amount={amount} />}
          {step === 'confirm' && (
            <div className="w-full p-6 text-center">
              {/* Simple confirm / processing UI; replace with your sending logic */}
              <p className="text-sm text-zinc-400 mb-4">Processing transaction…</p>
              <div className="mx-auto w-10 h-10 border-4 border-t-transparent rounded-full animate-spin border-white/30" />
              <div className="mt-6 flex gap-2 justify-center">
                <button
                  onClick={() => {
                    // after processing, reset the flow and close or show success screen
                    resetFlow();
                  }}
                  className="py-2 px-4 rounded bg-white/5"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

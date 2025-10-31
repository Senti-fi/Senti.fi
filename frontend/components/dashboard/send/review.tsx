'use client';

import React from 'react';
import Button from '@/components/Button';
import { shortenAddress } from '@/lib/helpers';

export default function Review({
  onNext,
  token,
  address,
  amount,
}: {
  onNext: () => void;
  token: string;
  address: string;
  amount: string;
}) {

  return (
    <div className="h-fit flex w-full flex-col bg-[#303030] p-4 pb-6 rounded-lg">
      <p className="text-lg font-semibold text-[#D8E1F2] mb-2">Review & Confirm</p>
      <p className="text-sm text-[#9A9A9A]">Please review your transaction details</p>

      <div className="my-6 bg-[#222222] rounded-lg space-y-3 p-6">
        <div className="flex justify-between items-center">
          <p className="font-semibold text-sm">Token</p>
          <p className="text-sm">{token}</p>
        </div>
        <div className="flex justify-between items-center">
          <p className="font-semibold text-sm">Amount</p>
          <p className="text-sm">
            {amount} {token}
          </p>
        </div>
        <div className="flex justify-between items-center">
          <p className="font-semibold text-sm">To</p>
          <p className="text-sm">{shortenAddress(address)}</p>
        </div>
        {/* <div className="flex justify-between items-center">
          <p className="font-semibold text-sm">Network Fee</p>
          <p className="text-sm">0.00</p>
        </div> */}
      </div>

      <Button text="Confirm Send" color="blue" onClick={()=>onNext()} />
    </div>
  );
}

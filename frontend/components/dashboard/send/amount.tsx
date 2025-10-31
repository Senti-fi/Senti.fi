'use client';


import React, { useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useWalletContext } from '@/context/WalletContext';
import Image from 'next/image';
import { QRCodeCanvas } from 'qrcode.react';
import { SearchIcon } from '@/components/icons/svgs';
import Button from '@/components/Button';

export default function Amount({ onNext, token , availBal}: { onNext: (amount: string) => void,  token: string, availBal: string }) {
    const [amount, setAmount] = useState<string>('');

    return (
        <div className=" h-full flex w-full flex-col bg-[#222222]">

            <p className='text-xm font-semibold text-[#D8E1F2] mb-2'>Enter Amount</p>
            <p className='text-sm text-[#9A9A9A]'>How much {token} do you want to send?</p>
            <div className="relative w-full mt-10 mb-2">
                <input
                    type="tel"
                    onChange={e => setAmount(e.target.value)}
                    placeholder="$0.00"
                    className="w-full px-4 py-3 text-center rounded-lg  text-white placeholder:text-5xl placeholder:font-bold placeholder:text-[#807e7e] text-5xl font-bold focus:outline-none focus:ring-0"
                />
            </div>
            <p className='text-xs text-center text-[#f3f1ef] mb-10'>Available balance: {availBal}</p>

            <Button text='Review Transaction' color='dark' onClick={()=>{onNext(amount)}}/>

        </div>
    )
}
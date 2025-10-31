'use client';


import React, { useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useWalletContext } from '@/context/WalletContext';
import Image from 'next/image';
import { QRCodeCanvas } from 'qrcode.react';
import { SearchIcon } from '@/components/icons/svgs';
import Button from '@/components/Button';

export default function Receipent({ onNext }: { onNext: (address: string) => void }) {
    const [address, setAddress] = useState<string>('');

    return (
        <div className=" h-full flex w-full flex-col bg-[#222222]">

            <p className='text-sm font-semibold text-[#D8E1F2] mb-2'>Recipient Address</p>
            <div className="relative w-full  mb-5">
                <input
                    type="text"
                    onChange={e => setAddress(e.target.value)}
                    placeholder="Paste wallet address here"
                    className="w-full px-4 py-3 rounded-lg bg-[#303030]  text-white placeholder-gray-400 placeholder:text-sm focus:outline-none focus:ring-0"
                />
            </div>

            <p className='text-sm font-semibold text-[#D8E1F2] mb-2'>Memo (Optional)</p>
            <div className="relative w-full mb-8">
                <input
                    type="text"
                    placeholder="Add note here..."
                    className="w-full px-4 py-3 rounded-lg bg-[#303030]  text-white placeholder-gray-400 placeholder:text-sm focus:outline-none focus:ring-0"
                />
            </div>

            <Button text='Proceed' color='blue' onClick={()=>{onNext(address)}}/>

        </div>
    )
}
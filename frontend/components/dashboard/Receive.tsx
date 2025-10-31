'use client';


import React, { useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useWalletContext } from '@/context/WalletContext';
import Image from 'next/image';
import { QRCodeCanvas } from 'qrcode.react';

export default function Receive() {
    const { pubKey } = useWalletContext();
    const [token, setToken] = useState<'SOL' | 'USDC' | 'USDT'>('SOL');
    const [copied, setCopied] = useState(false);


    async function handleCopyAddress() {
        try {
            if (!pubKey) return;
            await navigator.clipboard.writeText(pubKey);
            // replace with your toast/notification
            console.log('Copied address');
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('copy error', err);
        }
    }

    return (
        <div className="px-6 h-full flex flex-col bg-[#222222]">
            <div className="flex-1 overflow-y-auto">
                <div className="flex flex-col items-center gap-4 max-sm:gap-6 h-[80%]">
                    <div className="flex flex-col gap-5 items-center justify-between mb-4">
                        <div>
                            <h3 className="text-2xl text-center font-bold text-[#D8E1F2]">Receive {token}</h3>
                            <p className="text-sm text-[#9A9A9A]">Share your wallet address or QR code.</p>
                        </div>

                        <div className='flex gap-2 bg-[#005CE60D] rounded-sm cursor-pointer'>
                            <div className={`${token == 'SOL' ? ' bg-[#005CE6] text-[#191919] rounded-xl' : 'text-[#D8E1F2]'} py-2 px-8 text-sm`} onClick={()=>{setToken('SOL')}}>SOL</div>
                            <div className={`${token == 'USDC' ? ' bg-[#005CE6] text-[#191919] rounded-xl' : 'text-[#D8E1F2]'} py-2 px-8 text-sm`} onClick={()=>{setToken('USDC')}}>USDC</div>
                            <div className={`${token == 'USDT' ? ' bg-[#005CE6] text-[#191919] rounded-xl' : 'text-[#D8E1F2]'} py-2 px-8 text-sm`} onClick={()=>{setToken('USDT')}}>USDT</div>
                        </div>
                    </div>

                    


                    <div className="bg-[#222222] rounded-xl p-4">
                        {pubKey ? (
                            <QRCodeCanvas value={pubKey} size={200}  bgColor="#222222" fgColor="#FFFFFF" />
                        ) : (
                            <div className="w-[160px] h-[160px] flex items-center justify-center text-sm text-[#A4A4A4]">No wallet</div>
                        )}
                    </div>


                    <div className="w-full text-center">
                        <div className="text-lg text-[#CDCDCD] mb-1 font-semibold">Your {token} Address</div>
                        <div className="rounded-md break-words text-sm text-[#9A9A9A]">{pubKey ?? 'No wallet loaded'}</div>
                        <div className="mt-3 flex gap-2 justify-center">
                            <button onClick={handleCopyAddress} className="py-2 px-4 text-xs rounded-sm cursor-pointer bg-blue-500/30">
                               {copied == true ? 'Copied Address' : 'Copy Address'} 
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
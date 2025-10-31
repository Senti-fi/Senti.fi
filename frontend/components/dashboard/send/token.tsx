// src/components/TokenPage.tsx   <-- update path/name to match your project
"use client";

import React from "react";
import { useWalletContext } from "@/context/WalletContext";
import TokenSelector from "@/components/TokenSelector";

type Props = {
  onSelect: (selectedToken: "SOL" | "USDC" | "USDT", availBal: string) => void;
};

export default function Token({ onSelect }: Props) {
  const { pubKey } = useWalletContext();

  // forward the selection from TokenSelector to parent with typed token names
  const handleSelect = (sym: string, bal: string) => {
    const upper = sym?.toUpperCase?.() ?? "";
    if (upper === "SOL" || upper === "USDC" || upper === "USDT") {
      onSelect(upper as "SOL" | "USDC" | "USDT", bal);
    } else {
      // if TokenSelector returns other tokens, try to pass them through as best-effort
      onSelect((upper as any) as "SOL" | "USDC" | "USDT", bal);
    }
  };

  return (
    <div className="h-full flex w-full flex-col bg-[#222222] ">

      <div className=" mb-4 px-">
        {/* <p className="text-xl font-bold text-[#E1E1E3]">Select Token</p> */}
        <p className="text-sm text-[#9A9A9A]">Choose which cryptocurrency to send</p>
      </div>

      <div className="">
        <div className="bg-[#111111] rounded-xl p-3">
          <TokenSelector
            supportedTokens={["SOL", "USDC", "USDT"]}
            showSearch
            onSelect={handleSelect}
          />
        </div>
      </div>
    </div>
  );
}

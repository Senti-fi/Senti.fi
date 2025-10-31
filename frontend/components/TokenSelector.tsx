// src/components/TokenSelector.tsx
"use client";

import React, { useMemo, useState } from "react";
import { useWalletContext } from "@/context/WalletContext";
import { useWalletBalancesRealtime } from "@/hooks/useWalletBalancesRealtime";
import { SearchIcon } from "@/components/icons/svgs";

export type TokenOption = {
  symbol: string;
  uiAmount: number;
  mint?: string;
  accountAddress?: string;
  tokenIcon?: string | null;
  tokenName?: string | null;
  raw?: any;
};

type Props = {
  onSelect: (selectedToken: string, availBal: string) => void;
  selected?: string;
  supportedTokens?: string[]; // if provided, filter tokens to these symbols (e.g. ['SOL','USDC','USDT'])
  showSearch?: boolean;
  className?: string;
};

export default function TokenSelector({
  onSelect,
  selected,
  supportedTokens,
  showSearch = false,
  className = "",
}: Props) {
  const { pubKey } = useWalletContext();
  // grab prices and aggregated data from the balances hook
  const { solBalance, tokens, loading, prices, bySymbol } = useWalletBalancesRealtime(
    "https://api.devnet.solana.com"
  );

  const [query, setQuery] = useState<string>("");
  const [current, setCurrent] = useState<string | undefined>(selected);

  // helper formatters
  const fmt = (v: number | null | undefined, digits = 2) => {
    if (v == null || Number.isNaN(v)) return "0.00";
    return v.toFixed(digits);
  };
  const fmtCurrency = (v: number | null | undefined) => (v == null || Number.isNaN(v) ? "—" : `$${v.toFixed(2)}`);

  // build normalized list (SOL + SPL tokens)
  const tokenList = useMemo(() => {
    const out: TokenOption[] = [];

    // SOL entry
    out.push({
      symbol: "SOL",
      uiAmount: typeof solBalance === "number" ? solBalance : 0,
      tokenName: "Solana",
      tokenIcon: null,
      raw: null,
    });

    // SPL tokens from hook
    (tokens || []).forEach((t: any) => {
      const tokenSymbol = (t.tokenSymbol || t.symbol || "").toUpperCase();
      // compute uiAmount robustly
      const uiAmt =
        typeof t.uiAmount === "number"
          ? t.uiAmount
          : t.amountRaw && typeof t.decimals === "number"
          ? Number(t.amountRaw) / 10 ** t.decimals
          : 0;

      out.push({
        symbol: tokenSymbol || (t.mint ? `${t.mint.slice(0, 6)}...` : "TOKEN"),
        uiAmount: uiAmt,
        mint: t.mint,
        accountAddress: t.accountAddress,
        tokenIcon: t.tokenIcon ?? null,
        tokenName: t.tokenName ?? null,
        raw: t,
      });
    });

    // optionally filter to supportedTokens
    if (Array.isArray(supportedTokens) && supportedTokens.length > 0) {
      const upper = supportedTokens.map((s) => s.toUpperCase());
      return out.filter((o) => upper.includes(o.symbol));
    }
    return out;
  }, [solBalance, tokens, supportedTokens]);

  // filter by search query
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tokenList;
    return tokenList.filter(
      (t) =>
        (t.symbol || "").toLowerCase().includes(q) ||
        (t.tokenName || "").toLowerCase().includes(q) ||
        (t.mint || "").toLowerCase().includes(q)
    );
  }, [query, tokenList]);

  function handleSelect(tok: TokenOption) {
    setCurrent(tok.symbol);
    onSelect(tok.symbol, fmt(tok.uiAmount));
  }

  // helper to resolve price for a token symbol (prefers pyth live, falls back to bySymbol)
  const resolvePrice = (symbol: string | undefined) => {
    if (!symbol) return null;
    const key = symbol.toUpperCase();
    // pyth price object might be prices[key]?.price
    const pythEntry = (prices as any)?.[key] as any;
    const pythPrice = pythEntry?.price ?? null;
    if (typeof pythPrice === "number") return pythPrice;
    // fallback to aggregated bySymbol usdPrice
    const agg = (bySymbol as any)?.[key] as any;
    const aggPrice = agg?.usdPrice ?? null;
    if (typeof aggPrice === "number") return aggPrice;
    return null;
  };

  return (
    <div className={`h-full flex w-full flex-col ${className}`}>
      {showSearch && (
        <div className="relative w-full mb-4">
          <div
            className="absolute left-0 top-1/2 pl-2"
            style={{ transform: "translateY(-50%)" }}
            aria-hidden
          >
            <SearchIcon />
          </div>
          <input
            type="text"
            placeholder="Search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-[#121212] text-white placeholder-gray-400 placeholder:text-sm focus:outline-none focus:ring-0"
            aria-label="Search tokens"
          />
        </div>
      )}

      <div className="overflow-auto p-1">
        {loading ? (
          <div className="bg-[#292929] rounded-2xl p-4">Loading tokens…</div>
        ) : visible.length === 0 ? (
          <div className="bg-[#292929] rounded-2xl p-4">No tokens</div>
        ) : (
          <div className="space-y-3 pb-2">
            {visible.map((t) => {
              const fallbackLetters =
                t.symbol && t.symbol.length >= 2 ? t.symbol.slice(0, 2) : (t.mint || "TK").slice(0, 2);
              const isSelected = current === t.symbol;

              const price = resolvePrice(t.symbol);
              const ui = typeof t.uiAmount === "number" ? t.uiAmount : 0;
              const usd = price != null ? ui * price : null;

              // prefer explicit tokenIcon, otherwise use SOL image for SOL symbol, otherwise null
              const iconSrc = t.tokenIcon ?? (t.symbol?.toUpperCase() === "SOL" ? "/images/sol.jpeg" : null);

              return (
                <div
                  key={t.accountAddress ?? t.mint ?? t.symbol}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelect(t)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSelect(t);
                    }
                  }}
                  className={`bg-[#292929] rounded-2xl p-4 flex items-center justify-between cursor-pointer focus:outline-none focus:ring-2 ${
                    isSelected ? "ring-2 ring-[#27AAE1] bg-[#2b2b2b]" : "hover:bg-[#333333]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {iconSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={iconSrc} alt={t.symbol ?? "token"} className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-black border flex items-center justify-center text-[#D8E1F2] font-semibold">
                        {fallbackLetters}
                      </div>
                    )}

                    <div>
                      <div className="font-semibold text-lg">{t.tokenName ?? t.symbol}</div>
                      <div className="text-xs text-[#9A9A9A]"> {price != null ? `${fmtCurrency(price)}` : ``}</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-semibold text-lg">{fmt(t.uiAmount, 2)} {t.symbol}</div>
                    <div className="text-sm text-[#9A9A9A]">
                      {price != null ? `${fmtCurrency(usd)}` : ``}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

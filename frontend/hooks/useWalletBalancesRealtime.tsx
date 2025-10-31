// src/hooks/useWalletBalancesRealtime.ts
"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Connection, PublicKey, clusterApiUrl, AccountInfo } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { TokenListProvider, TokenInfo } from "@solana/spl-token-registry";
import { useWalletContext } from "@/context/WalletContext";
import { usePythPrices, PythPrice, PRICE_IDS } from "@/hooks/usePythPrices"; // adjust path if needed

export type TokenAsset = {
  mint: string;
  amountRaw: string;
  uiAmount?: number | null;
  decimals: number;
  tokenName?: string;
  tokenSymbol?: string;
  tokenIcon?: string;
  accountAddress: string;
};

// -----------------------------
// Module-level cache for token lists
// -----------------------------
let GLOBAL_TOKEN_MAP: Map<string, TokenInfo> | null = null;
let GLOBAL_TOKEN_MAP_PROMISE: Promise<Map<string, TokenInfo>> | null = null;

async function loadTokenListForChain(chainId: number): Promise<Map<string, TokenInfo>> {
  if (GLOBAL_TOKEN_MAP) return GLOBAL_TOKEN_MAP;
  if (GLOBAL_TOKEN_MAP_PROMISE) return GLOBAL_TOKEN_MAP_PROMISE;

  GLOBAL_TOKEN_MAP_PROMISE = (async () => {
    try {
      const provider = new TokenListProvider();
      const container = await provider.resolve();
      const list = container.filterByChainId(chainId).getList();
      const map = new Map(list.map((t: TokenInfo) => [t.address, t]));
      GLOBAL_TOKEN_MAP = map;
      return map;
    } catch (err) {
      console.warn("TokenListProvider.resolve failed", err);
      GLOBAL_TOKEN_MAP = new Map();
      return GLOBAL_TOKEN_MAP;
    } finally {
      GLOBAL_TOKEN_MAP_PROMISE = null;
    }
  })();

  return GLOBAL_TOKEN_MAP_PROMISE;
}

// -----------------------------
// localStorage keys & helpers
// -----------------------------
const LS_SOL_KEY = "senti:balances:sol";
const LS_TOKENS_KEY = "senti:balances:tokens";
const LS_PYTH_PRICES_KEY = "senti:prices:pyth";

function safeReadJSON<T = any>(key: string, fallback: T): T {
  try {
    if (typeof window === "undefined") return fallback;
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (e) {
    console.warn("safeReadJSON failed", e);
    return fallback;
  }
}

function safeWriteJSON(key: string, val: any) {
  try {
    if (typeof window === "undefined") return;
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    console.warn("safeWriteJSON failed", e);
  }
}

// -----------------------------
// Helper types for USD aggregation
// -----------------------------
export type SymbolBalance = {
  symbol: string;
  uiAmount: number; // summed UI amount for this symbol
  usdPrice?: number | null; // current price in USD
  usdValue?: number; // uiAmount * usdPrice
  rawMints?: string[]; // which mints contributed
};

export type WalletBalancesRealtimeResult = {
  solBalance: number | null;
  tokens: TokenAsset[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  prices: Record<string, PythPrice | undefined>;
  bySymbol: Record<string, SymbolBalance>;
  totalUsd: number;
};

// -----------------------------
export function useWalletBalancesRealtime(rpcUrl?: string): WalletBalancesRealtimeResult {
  const { pubKey } = useWalletContext();

  // lazy initialization — read localStorage only when running in the browser
  const [solBalance, setSolBalance] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    return safeReadJSON<number | null>(LS_SOL_KEY, null);
  });
  const [tokens, setTokens] = useState<TokenAsset[]>(() => {
    if (typeof window === "undefined") return [];
    return safeReadJSON<TokenAsset[]>(LS_TOKENS_KEY, []);
  });

  // load any cached pyth prices lazily
  const [pythCached, setPythCached] = useState<Record<string, PythPrice> | null>(() => {
    if (typeof window === "undefined") return null;
    return safeReadJSON<Record<string, PythPrice> | null>(LS_PYTH_PRICES_KEY, null);
  });

  // loading only true when we have no cached data
  const [loading, setLoading] = useState<boolean>(() => {
    const hasSol = typeof solBalance === "number";
    const hasTokens = Array.isArray(tokens) && tokens.length > 0;
    return !(hasSol || hasTokens);
  });

  const [error, setError] = useState<string | null>(null);

  const tokenMapRef = useRef<Map<string, TokenInfo> | undefined>(undefined);

  // stable RPC and connection
  const resolvedRpc = "https://api.devnet.solana.com"
  const connection = useMemo(() => new Connection(resolvedRpc, "confirmed"), [resolvedRpc]);

  // guard to avoid init spamming
  const lastInitRef = useRef<number | null>(null);
  const MIN_INIT_INTERVAL_MS = 1000;

  const getChainIdForRpc = (url: string) => {
    if (url.includes("devnet")) return 103;
    if (url.includes("testnet")) return 102;
    return 101;
  };

  // --------------------------
  // integrate Pyth prices (realtime)
  // --------------------------
  const { prices: pythPricesRaw, isConnected: pricesConnected, isLoading: pricesLoading } = usePythPrices({
    // optionally pass endpoint override here
  });

  // a ref storing last persisted serialized pyth cache to avoid unnecessary setState/write loops
  const pythCachedRef = useRef<string | null>(
    typeof window !== "undefined" ? (localStorage.getItem(LS_PYTH_PRICES_KEY) ?? null) : null
  );

  // Persist lightweight Pyth prices to localStorage, but ONLY if changed (prevent loops)
  useEffect(() => {
    if (!pythPricesRaw || Object.keys(pythPricesRaw).length === 0) return;

    try {
      // build lightweight object to persist
      const lightweight: Record<string, PythPrice> = {};
      Object.entries(pythPricesRaw).forEach(([k, v]) => {
        if (!v) return;
        // persist only the fields we need
        lightweight[k] = {
          price: v.price ?? null,
          conf: v.conf ?? null,
          expo: v.expo ?? null,
          publish_time: v.publish_time ?? null,
        } as PythPrice;
      });

      const serialized = JSON.stringify(lightweight);
      if (pythCachedRef.current !== serialized) {
        // update ref first to avoid race where setState triggers effect again
        pythCachedRef.current = serialized;
        setPythCached(lightweight);
        safeWriteJSON(LS_PYTH_PRICES_KEY, lightweight);
      }
      // otherwise skip — nothing changed
    } catch (e) {
      console.warn("persisting pyth prices failed", e);
    }
  }, [pythPricesRaw]);

  // prefer live feed, otherwise fallback to cached persisted prices
  const pythPrices = useMemo(() => {
    if (pythPricesRaw && Object.keys(pythPricesRaw).length > 0) return pythPricesRaw;
    if (pythCached) return pythCached;
    return {};
  }, [pythPricesRaw, pythCached]);

  // fetch balances — unchanged behavior (but persisted after fetch)
  const fetchBalances = useCallback(
    async (tokenMap?: Map<string, TokenInfo>) => {
      if (!pubKey) return;
      setError(null);

      try {
        const owner = new PublicKey(pubKey);

        // SOL
        const lamports = await connection.getBalance(owner, "confirmed");
        const newSol = lamports / 1e9;
        setSolBalance(newSol);
        safeWriteJSON(LS_SOL_KEY, newSol);

        // SPL tokens
        const resp = await connection.getParsedTokenAccountsByOwner(owner, {
          programId: TOKEN_PROGRAM_ID,
        });

        const parsedTokens: TokenAsset[] = resp.value
          .map((t) => {
            try {
              const parsedInfo = (t.account.data as any).parsed?.info;
              if (!parsedInfo) return null;
              const tokenAmount = parsedInfo.tokenAmount;
              return {
                mint: parsedInfo.mint,
                amountRaw: tokenAmount.amount,
                uiAmount: tokenAmount.uiAmount,
                decimals: tokenAmount.decimals,
                accountAddress: t.pubkey.toBase58(),
                tokenName: tokenMap?.get(parsedInfo.mint)?.name,
                tokenSymbol: tokenMap?.get(parsedInfo.mint)?.symbol,
                tokenIcon: tokenMap?.get(parsedInfo.mint)?.logoURI,
              } as TokenAsset;
            } catch (err) {
              console.warn("parse token account failed", err);
              return null;
            }
          })
          .filter(Boolean) as TokenAsset[];

        const nonZero = parsedTokens.filter((t) => t.amountRaw !== "0");
        setTokens(nonZero);
        safeWriteJSON(LS_TOKENS_KEY, nonZero);
      } catch (err: any) {
        console.error("fetchBalances error", err);
        setError(err?.message ?? String(err));
      }
    },
    [pubKey, connection]
  );

  // init + subscriptions (quiet if cached snapshot exists)
  useEffect(() => {
    if (!pubKey) {
      setSolBalance(null);
      setTokens([]);
      safeWriteJSON(LS_SOL_KEY, null);
      safeWriteJSON(LS_TOKENS_KEY, []);
      return;
    }

    const now = Date.now();
    if (lastInitRef.current && now - lastInitRef.current < MIN_INIT_INTERVAL_MS) return;
    lastInitRef.current = now;

    let solSubId: number | null = null;
    const tokenSubIds: number[] = [];
    let active = true;

    const init = async () => {
      // only show loading when we have absolutely no cached data
      if ((solBalance === null || solBalance === undefined) && (!tokens || tokens.length === 0)) {
        setLoading(true);
      } else {
        setLoading(false);
      }
      setError(null);

      try {
        const chainId = getChainIdForRpc(resolvedRpc);
        const tokenMap = await loadTokenListForChain(chainId);
        tokenMapRef.current = tokenMap;

        // background fetch (do not force loading if we have cached snapshot)
        fetchBalances(tokenMap).catch((e) => console.warn("background fetchBalances failed", e));

        if (!active) return;

        // subscribe to SOL account changes
        try {
          const owner = new PublicKey(pubKey);
          solSubId = connection.onAccountChange(owner, (accInfo: AccountInfo<Buffer>) => {
            try {
              // @ts-ignore
              const lamports = (accInfo as any).lamports ?? null;
              if (typeof lamports === "number") {
                const sol = lamports / 1e9;
                setSolBalance(sol);
                safeWriteJSON(LS_SOL_KEY, sol);
              } else {
                fetchBalances(tokenMap).catch(console.error);
              }
            } catch (err) {
              console.warn("sol account change handler error", err);
              fetchBalances(tokenMap).catch(console.error);
            }
          });
        } catch (err) {
          console.warn("sol subscription failed", err);
        }

        // subscribe to token accounts (quiet updates)
        try {
          const owner = new PublicKey(pubKey);
          const tokenAccounts = await connection.getParsedTokenAccountsByOwner(owner, {
            programId: TOKEN_PROGRAM_ID,
          });

          tokenAccounts.value.forEach((t) => {
            try {
              const pubkey = t.pubkey;
              const subId = connection.onAccountChange(pubkey, (accInfo: AccountInfo<Buffer>) => {
                try {
                  const parsed = (accInfo.data as any)?.parsed?.info;
                  if (!parsed) {
                    fetchBalances(tokenMap).catch(console.error);
                    return;
                  }
                  const tokenAmount = parsed.tokenAmount;
                  setTokens((prev) =>
                    prev.map((tok) =>
                      tok.accountAddress === pubkey.toBase58()
                        ? { ...tok, amountRaw: tokenAmount.amount, uiAmount: tokenAmount.uiAmount }
                        : tok
                    )
                  );
                  // persist after a short delay
                  setTimeout(() => {
                    safeWriteJSON(LS_TOKENS_KEY, ((): TokenAsset[] => {
                      try {
                        return (JSON.parse(localStorage.getItem(LS_TOKENS_KEY) || "[]") as TokenAsset[]) || [];
                      } catch {
                        return [];
                      }
                    })());
                    fetchBalances(tokenMap).catch(console.error);
                  }, 100);
                } catch (err) {
                  console.warn("token account parse error", err);
                  fetchBalances(tokenMap).catch(console.error);
                }
              });
              tokenSubIds.push(subId);
            } catch (err) {
              console.warn("subscribe token account error", err);
            }
          });
        } catch (err) {
          console.warn("token accounts subscribe setup failed", err);
        }
      } catch (err) {
        console.error("init error", err);
        setError((err as any)?.message ?? "init failed");
      } finally {
        if (active) setLoading(false);
      }
    };

    init();

    return () => {
      active = false;
      try {
        if (solSubId !== null) connection.removeAccountChangeListener(solSubId);
      } catch (err) {
        console.warn("remove sol subscription failed", err);
      }
      tokenSubIds.forEach((id) => {
        try {
          connection.removeAccountChangeListener(id);
        } catch (e) {
          console.warn("remove token subscription failed", e);
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pubKey, connection, fetchBalances, resolvedRpc]);

  const refresh = useCallback(() => {
    return fetchBalances(tokenMapRef.current);
  }, [fetchBalances]);

  // --------------------------
  // Aggregate and compute usd values
  // --------------------------
  const bySymbol = useMemo(() => {
    const map: Record<string, SymbolBalance> = {};
    const add = (symbol: string, uiAmount: number, mint?: string) => {
      if (!map[symbol]) {
        map[symbol] = { symbol, uiAmount: 0, usdPrice: null, usdValue: 0, rawMints: [] };
      }
      map[symbol].uiAmount += uiAmount;
      if (mint) map[symbol].rawMints!.push(mint);
    };

    if (typeof solBalance === "number") add("SOL", solBalance, "SOL_NATIVE");
    tokens.forEach((t) => {
      const symbol = t.tokenSymbol ?? t.mint;
      const ui = typeof t.uiAmount === "number" ? t.uiAmount : 0;
      add(symbol, ui, t.mint);
    });

    Object.values(map).forEach((sb) => {
      const pythEntry = (pythPrices as any)[sb.symbol] as PythPrice | undefined;
      const priceNumber = pythEntry?.price ?? null;
      sb.usdPrice = typeof priceNumber === "number" ? priceNumber : null;
      sb.usdValue = (sb.uiAmount || 0) * (sb.usdPrice || 0);
    });

    return map;
  }, [solBalance, tokens, pythPrices]);

  const totalUsd = useMemo(() => {
    return Object.values(bySymbol).reduce((s, b) => s + (b.usdValue ?? 0), 0);
  }, [bySymbol]);

  const pricesOut = useMemo(() => {
    return pythPrices;
  }, [pythPrices]);

  // effective loading: if we have cached tokens/sol, don't show loading while pyth feed connects
  const effectiveLoading = useMemo(() => {
    const hasSnapshot = (typeof solBalance === "number") || (Array.isArray(tokens) && tokens.length > 0);
    // show loading if no snapshot and either balances or prices are still fetching
    return !hasSnapshot && (loading || pricesLoading);
  }, [loading, pricesLoading, solBalance, tokens]);

  return {
    solBalance,
    tokens,
    loading: effectiveLoading,
    error,
    refresh,
    prices: pricesOut,
    bySymbol,
    totalUsd,
  };
}

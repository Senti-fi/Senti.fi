// src/components/dashboard/TransactionsList.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWalletAuth } from "@/hooks/useWalletAuth";
import { RefreshIcon } from "../icons/svgs";
import { shortenAddress } from "@/lib/helpers";
import { useWalletBalancesRealtime } from "@/hooks/useWalletBalancesRealtime";

type Tx = {
  id?: string;
  txHash?: string;
  type?: string;
  token?: string;
  amount?: number;
  timestamp?: string | number;
  sender?: string | null;
  recipient?: string | null;
  vaultPubkey?: string | null;
  [k: string]: any;
};

type Props = {
  pubKey?: string | null;
  tokens?: Array<{ tokenSymbol?: string }>;
  showFilter?: boolean;
  initialFilter?: "all" | "deposits" | "withdrawals";
  lsKeyPrefix?: string;
  onTransactionsChange?: (txs: Tx[]) => void;
  solBalance? : string
};

const defaultPrefix = "senti:txs:";

/** normalize type string */
const normalizedType = (tx: Tx) => ((tx.type || "") as string).toLowerCase().trim();

/** deposit/withdraw detection (keeps previous heuristics) */
const isDeposit = (tx: Tx) => {
  const t = normalizedType(tx);
  return t === "deposit" || t === "deposited" || t === "in" || t === "receive-deposit";
};
const isWithdrawal = (tx: Tx) => {
  const t = normalizedType(tx);
  return t === "withdrawal" || t === "withdraw" || t === "withdrew" || t === "out" || t === "withdrawn";
};

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

export default function TransactionsList({
  pubKey,
  tokens = [],
  showFilter = true,
  initialFilter = "all",
  lsKeyPrefix = defaultPrefix,
  onTransactionsChange,
}: Props) {
  const { monitorAndFetchAllTransactions } = useWalletAuth();
    const { solBalance } = useWalletBalancesRealtime("https://api.devnet.solana.com");

  const [filter, setFilter] = useState<"all" | "deposits" | "withdrawals">(initialFilter);
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const inflightPromiseRef = useRef<Promise<any> | null>(null);
  const latestRequestIdRef = useRef<number>(0);

  const txStorageKey = pubKey ? `${lsKeyPrefix}${pubKey}` : null;

  useEffect(() => {
    if (!pubKey) {
      setTransactions([]);
      setError(null);
      setLoading(false);
      return;
    }

    const cached = txStorageKey ? safeReadJSON<Tx[]>(txStorageKey, []) : [];
    if (cached && Array.isArray(cached) && cached.length > 0) {
      setTransactions(cached);
      setLoading(false);
      setError(null);
    } else {
      setTransactions([]);
      setLoading(true);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pubKey]);

  useEffect(() => {
    if (onTransactionsChange) onTransactionsChange(transactions);
  }, [transactions, onTransactionsChange]);

  const fetchAndPersistTransactions = useCallback(
    async (tokensToMonitor: string[] = ["SOL"]) => {
      if (!pubKey) return { transactions: [], monitorResults: [] };

      if (inflightPromiseRef.current) return inflightPromiseRef.current;

      const requestId = ++latestRequestIdRef.current;

      const promise = (async () => {
        try {
          if (!monitorAndFetchAllTransactions) {
            throw new Error("monitorAndFetchAllTransactions not available from hook");
          }
          const res = await monitorAndFetchAllTransactions(tokensToMonitor);
          if (requestId === latestRequestIdRef.current) {
            const fetched = res.transactions ?? [];
            setTransactions(fetched);
            if (txStorageKey) safeWriteJSON(txStorageKey, fetched);
            setError(null);
          }
          return res;
        } catch (err: any) {
          console.error("monitorAndFetchAllTransactions error:", err);
          const cached = txStorageKey ? safeReadJSON<Tx[]>(txStorageKey, []) : [];
          if (!cached || cached.length === 0) {
            setError(err?.message ?? "Failed to load transactions");
          }
          throw err;
        } finally {
          inflightPromiseRef.current = null;
        }
      })();

      inflightPromiseRef.current = promise;
      return promise;
    },
    [monitorAndFetchAllTransactions, pubKey, txStorageKey]
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!pubKey || !monitorAndFetchAllTransactions) return;

      const extraTokens = (tokens || []).map(t => (t.tokenSymbol || "").toUpperCase()).filter(Boolean);
      const tokenSet = new Set<string>(["SOL", ...extraTokens]);
      const tokensToMonitor = Array.from(tokenSet).filter(t => ["SOL", "USDC", "USDT"].includes(t));

      const cached = txStorageKey ? safeReadJSON<Tx[]>(txStorageKey, []) : [];
      if (!cached || cached.length === 0) {
        setLoading(true);
      } else {
        setLoading(false);
      }
      setError(null);

      try {
        await fetchAndPersistTransactions(tokensToMonitor);
      } catch {
        /* handled */
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [pubKey, monitorAndFetchAllTransactions, tokens, fetchAndPersistTransactions, txStorageKey, solBalance]);

  const manualRefresh = useCallback(async () => {
    if (!pubKey || !monitorAndFetchAllTransactions) return;
    setLoading(true);
    setError(null);

    const extraTokens = (tokens || []).map(t => (t.tokenSymbol || "").toUpperCase()).filter(Boolean);
    const tokenSet = new Set<string>(["SOL", ...extraTokens]);
    const tokensToMonitor = Array.from(tokenSet).filter(t => ["SOL", "USDC", "USDT"].includes(t));

    try {
      await fetchAndPersistTransactions(tokensToMonitor);
    } catch (err: any) {
      setError(err?.message ?? "Refresh failed");
    } finally {
      setLoading(false);
    }
  }, [pubKey, monitorAndFetchAllTransactions, tokens, fetchAndPersistTransactions]);

  const filtered = useMemo(() => {
    if (filter === "all") return transactions;
    if (filter === "deposits") return transactions.filter(isDeposit);
    if (filter === "withdrawals") return transactions.filter(isWithdrawal);
    return transactions;
  }, [transactions, filter]);

  // helper: determine visual traits per tx
  function txVisuals(tx: Tx) {
    const t = normalizedType(tx);

    // new arrow rules (per your request)
    // - receive/reward: green, arrow DOWN
    // - send/sent: red, arrow UP
    // - fee (or similar): red, arrow UP
    //
    // keep other mappings from earlier logic (withdrawal stays positive/green)
    const arrowDown = t === "receive" || t === "reward" || t === "withdraw" || t === "withdrawal" || t === "withdrew";
    const arrowUp = t === "send" || t === "sent" || t === "fee" || t === "transfer_fee" || t === "txn_fee" || t === "deposit" || t === "deposited";

    // positive mapping: receive and withdrawals are positive (green +)
    const positive = t === "receive" || t === "reward" || t === "withdraw" || t === "withdrawal" || t === "withdrew";
    // negative mapping: send and fee (and deposit if previously mapped) are red minus
    const negative = t === "send" || t === "sent" || t === "fee" || t === "transfer_fee" || t === "txn_fee" || t === "deposit" || t === "deposited";

    // label (past tense)
    let label = "";
    if (t === "receive" || t === "reward") label = "Received";
    else if (t === "send" || t === "sent") label = "Sent";
    else if (t === "deposit" || t === "deposited") label = "Deposited";
    else if (t === "withdraw" || t === "withdrawal" || t === "withdrew") label = "Withdrew";
    else if (t === "fee" || t === "transfer_fee" || t === "txn_fee") label = "Fee";
    else label = (tx.type || "Tx").charAt(0).toUpperCase() + (tx.type || "Tx").slice(1);

    // from/to: for receive use sender, for send use recipient, for deposit/withdrawal use vaultPubkey
    let counterpartyLabel = "-";
    if (t === "receive" || t === "reward") {
      counterpartyLabel = tx.sender ? shortenAddress(String(tx.sender)) : "-";
    } else if (t === "send" || t === "sent") {
      counterpartyLabel = tx.recipient ? shortenAddress(String(tx.recipient)) : "-";
    } else if (t === "deposit" || t === "deposited" || t === "withdraw" || t === "withdrawal" || t === "withdrew" || t === "fee" || t === "transfer_fee" || t === "txn_fee" ) {
      counterpartyLabel = tx.vaultPubkey ? shortenAddress(String(tx.vaultPubkey)) : "-";
    } else {
      counterpartyLabel = (tx.recipient && shortenAddress(String(tx.recipient))) || (tx.sender && shortenAddress(String(tx.sender))) || "-";
    }

    return {
      arrowUp,
      arrowDown,
      positive,
      negative,
      label,
      counterpartyLabel,
    };
  }

  const CLUSTER = process.env.NEXT_PUBLIC_SOLANA_CLUSTER || "devnet";
  const explorerTxUrl = (txid: string) => `https://explorer.solana.com/tx/${txid}?cluster=${CLUSTER}`;

  return (
    <div>
      <div className="flex max-md:flex-col gap-4 max-md:items-start items-center justify-between mb-4">
        <h3 className="text-xl font-semibold">Recent Activity</h3>

        <div className="flex items-center gap-2">
          {showFilter && (
            <div className="inline-flex rounded-md bg-[#1F1F1F] p-1">
              <button
                onClick={() => setFilter("all")}
                className={`px-3 py-1 rounded-md text-sm ${filter === "all" ? "bg-[#292929] font-semibold" : "text-[#A4A4A4]"}`}
                aria-pressed={filter === "all"}
              >
                All
              </button>
              <button
                onClick={() => setFilter("deposits")}
                className={`px-3 py-1 rounded-md text-sm ${filter === "deposits" ? "bg-[#292929] font-semibold" : "text-[#A4A4A4]"}`}
                aria-pressed={filter === "deposits"}
              >
                Deposits
              </button>
              <button
                onClick={() => setFilter("withdrawals")}
                className={`px-3 py-1 rounded-md text-sm ${filter === "withdrawals" ? "bg-[#292929] font-semibold" : "text-[#A4A4A4]"}`}
                aria-pressed={filter === "withdrawals"}
              >
                Withdrawals
              </button>
            </div>
          )}

          <button
            onClick={() => manualRefresh()}
            className="text-blue-200 hover:text-white transition-colors text-sm"
            title="Refresh transactions"
            aria-label="Refresh transactions"
          >
            <RefreshIcon />
          </button>
        </div>
      </div>

      <div className="bg-[#292929] rounded-2xl py-4 px-2">
        {loading ? (
          <div className="text-center py-6">Loading transactions…</div>
        ) : error ? (
          <div className="text-center text-red-400 py-6">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-[#333333] rounded-2xl mx-auto mb-4 flex items-center justify-center">
              <svg className="w-8 h-8 text-[#A4A4A4]" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm3 6a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1zm1-3a1 1 0 100 2h4a1 1 0 100-2H8z" clipRule="evenodd" />
              </svg>
            </div>
            <h4 className="text-lg font-medium text-[#A4A4A4] mb-2">No transactions to show.</h4>
            <p className="text-[#A4A4A4] text-sm">Start by receiving crypto or adding cash.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((tx) => {
              const key = tx.id ?? tx.txHash ?? JSON.stringify(tx);
              const { arrowUp, arrowDown, positive, negative, label, counterpartyLabel } = txVisuals(tx);
              const token = (tx.token ?? "SOL").toString();
              const amount = Number(tx.amount ?? 0);
              const timestamp = tx.timestamp ? new Date(tx.timestamp).toLocaleString() : "";

              const Arrow = ({ up = false, down = false, colorClass = "text-white" }: { up?: boolean; down?: boolean; colorClass?: string }) => {
                // uses currentColor - so wrap container should set text color
                if (down) {
                  return (
                    <div className={colorClass}>
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M12 5v14" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M19 12l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  );
                }
                if (up) {
                  return (
                    <div className={colorClass}>
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M12 19V5" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  );
                }
                return (
                  <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                );
              };

              // amount sign & color
              const amountSign = positive ? "+" : negative ? "-" : "";
              const amountColorClass = positive ? "text-green-400" : negative ? "text-red-400" : "text-white";

              const signBadge = positive ? (
                <span className="inline-block text-xs font-semibold text-green-700 bg-green-100/5 px-1 rounded">+</span>
              ) : negative ? (
                <span className="inline-block text-xs font-semibold text-red-700 bg-red-100/5 px-1 rounded">−</span>
              ) : null;

              // direction label for counterparty
              const counterpartyDirection = (label === "Received" || label === "Withdrew") ? "From" : (label === "Sent" || label === "Deposited" || label === "Fee") ? "To" : "With";

              // arrow color classes (green for positive receive/withdraw; red for send/fee)
              const arrowColorClass = arrowDown && positive ? "text-green-300" : arrowUp && negative ? "text-red-300" : "text-white";

              return (
                <div key={key} className="flex items-center justify-between p-3 rounded-lg bg-[#0D0D0D]">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-12 h-12 rounded-lg bg-[#0b0b0b] flex items-center justify-center text-sm font-semibold ${positive ? "text-green-300" : negative ? "text-red-300" : "text-white"}`}>
                      <div className="flex flex-col items-center">
                        <div className={`${arrowDown ? "bg-green-100/10" : "bg-red-100/10"} rounded-full p-2`}>
                          <Arrow up={arrowUp} down={arrowDown} colorClass={arrowColorClass} />
                        </div>
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="font-semibold text-sm truncate">{label} • {token}</div>
                      </div>
                      <div className="text-xs mt-1 text-[#A4A4A4]">
                        <span className="ml-0">{counterpartyDirection}</span>
                        <span className="mx-2 font-mono">{counterpartyLabel}</span>
                        <span>•</span>
                        <span className="ml-2">{timestamp}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right flex flex-col items-end">
                    <div className={`font-semibold ${amountColorClass} flex items-center gap-2`}>
                      {/* {signBadge} */}
                      <span>{Number.isFinite(amount) ? `${amountSign}${amount.toFixed(2)}` : String(amount)}</span>
                    </div>
                    {tx.txHash && (
                      <div>
                        {/* <span className="mr-2 text-xs text-[#9A9A9A] mt-1">{timestamp}</span> */}
                        <a className="text-xs text-[#9A9A9A] mt-1" href={explorerTxUrl(tx.txHash)} target="_blank" rel="noreferrer">
                          {shortenAddress(tx.txHash)}
                        </a>
                      </div>
                    )}
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

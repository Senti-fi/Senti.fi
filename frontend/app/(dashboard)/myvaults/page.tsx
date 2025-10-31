// src/app/my-vaults/page.tsx
"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import apiClient from "@/lib/apiClient";
import Button from "@/components/Button";
import Modal from "@/components/ui/Modal";
import ErrorModal from "@/components/ui/ErrorModal";
import { shortenAddress, capitalizeFirst } from "@/lib/helpers";
import { useAuth } from "@/context/AuthContext";
import VaultBalance from "@/components/dashboard/vaultBalance";
import TransactionsList from "@/components/dashboard/TransactionsList";
import { useWalletContext } from "@/context/WalletContext";
import { useWalletBalancesRealtime } from "@/hooks/useWalletBalancesRealtime";
import VaultsChart from "@/components/dashboard/vaultChart";
import WithdrawPanel from "@/components/dashboard/WithdrawPanel";

type UserVaultDetail = {
  vaultName: string;
  vaultPubkey: string;
  token: string;
  amount: number;
  yieldRate?: number | null;
  lockedUntil?: string | null;
  isUnlocked: boolean;
  rewardsAccrued: number;
  usdPrice?: number | null;
  usdValue?: number;
  vaultPlanId?: string | null;
  vaultId?: string | null;
  userVaultId?: string | null;
};

export default function MyVaultsPage() {
  const { user } = useAuth();
  const [vaults, setVaults] = useState<UserVaultDetail[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { pubKey } = useWalletContext();
  const { prices, bySymbol, tokens } = useWalletBalancesRealtime("https://api.devnet.solana.com");
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [selectedVault, setSelectedVault] = useState<UserVaultDetail | null>(null)

  const mountedRef = useRef(true);

  // Fetch vaults
  const getVaultsForCurrentUser = async () => {
    if (!user?.id) {
      setVaults([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const resp = await apiClient.get(`/api/user/${user.id}/details`);
      const data = resp.data;
      const rawVaults = (data?.vaults ?? []) as UserVaultDetail[];

      const normalized: UserVaultDetail[] = rawVaults.map((v) => {
        const token = (v.token ?? "SOL").toString().toUpperCase();
        const amountNum = typeof v.amount === "string" ? Number(v.amount) : (v.amount ?? 0);

        const findPrice = () => {
          const p = (prices as any)?.[token];
          if (p && typeof p.price === "number") return p.price;
          const agg = (bySymbol as any)?.[token];
          if (agg && typeof agg.usdPrice === "number") return agg.usdPrice;
          const allValues = Object.values(prices || {}) as any[];
          for (const val of allValues) {
            const raw = val?.raw ?? val?.parsed ?? val;
            if (!raw) continue;
            if ((raw?.symbol && String(raw.symbol).toUpperCase() === token) || (raw?.asset && String(raw.asset).toUpperCase() === token)) {
              if (typeof val.price === "number") return val.price;
            }
          }
          return null;
        };

        const usdPrice = findPrice();
        const usdValue = usdPrice != null ? (amountNum * usdPrice) : 0;

        return {
          vaultName: v.vaultName ?? "Vault",
          vaultPubkey: v.vaultPubkey ?? v.vaultPubkey ?? "",
          token,
          amount: Number(amountNum),
          yieldRate: v.yieldRate ?? null,
          lockedUntil: v.lockedUntil ?? null,
          isUnlocked: !!v.isUnlocked,
          rewardsAccrued: typeof v.rewardsAccrued === "string" ? Number(v.rewardsAccrued) : (v.rewardsAccrued ?? 0),
          vaultPlanId: v.vaultPlanId,
          vaultId: v.vaultId,
          userVaultId: v.userVaultId,
          usdPrice,
          usdValue,
        };
      });

      if (!mountedRef.current) return;
      setVaults(normalized);
    } catch (err: any) {
      console.error("Failed to fetch user vaults", err);
      if (!mountedRef.current) return;
      setError(err?.response?.data?.error ?? err?.message ?? "Failed to load vaults");
      setVaults([]);
    } finally {
      if (!mountedRef.current) return;
      setLoading(false);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    getVaultsForCurrentUser();
    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const refresh = async () => {
    await getVaultsForCurrentUser();
  };

  const formatDate = (iso?: string | null) => {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      return d.toLocaleString();
    } catch {
      return iso;
    }
  };

  const vaultList = useMemo(() => {
    if (!vaults) return [];
    return vaults.map((v) => {
      const usdPrice = (v as any).usdPrice ?? null;
      const usdValue = (v as any).usdValue ?? (usdPrice != null ? v.amount * usdPrice : 0);
      return { ...v, usdPrice, usdValue };
    });
  }, [vaults, prices, bySymbol]);

  return (
    <div className="flex-1 p-4 md:p-6 overflow-y-auto">
      <VaultBalance />

      <div className="md:flex mb-6 md:mb-8 flex-wrap mt-8 justify-between gap-10 space-y-10 items-start ">
        <div className="md:space-y-4 md:min-w-2xl flex-1">
          <h2 className="text-xl md:text-2xl font-bold text-white mb-4 md:mb-6">My Vaults</h2>

          {loading ? (
            <div className="text-center text-white py-6">Loading vaults…</div>
          ) : error ? (
            <div className="text-center text-red-400 py-6">{error}</div>
          ) : vaultList.length === 0 ? (
            <div className="text-center text-white py-6">
              <div className="w-16 h-16 bg-[#333333] rounded-2xl mx-auto mb-4 flex items-center justify-center">
                <svg className="w-8 h-8 text-[#A4A4A4]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm3 6a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1zm1-3a1 1 0 100 2h4a1 1 0 100-2H8z" clipRule="evenodd" />
                </svg>
              </div>
              <h4 className="text-lg font-medium text-[#A4A4A4] mb-2">You have no active vaults.</h4>
              <p className="text-[#A4A4A4] text-sm">Start saving by depositing into one of our plans.</p>
            </div>
          ) : (
            <div className="space-y-3 w-full">
              {vaultList.map((v) => {
                const unlocked = v.isUnlocked;
                const lockedUntilReadable = formatDate(v.lockedUntil);
                const apyLabel = typeof v.yieldRate === "number" ? `${(v.yieldRate * 100).toFixed(2).replace(/\.00$/, "")}% APY` : "—";
                const usdPrice = (v as any).usdPrice;
                const usdValue = (v as any).usdValue ?? (usdPrice != null ? v.amount * usdPrice : 0);

                return (
                  <div key={v.vaultPubkey} className="bg-[#0D0D0D] rounded-2xl p-4 md:px-6 w-full flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1 min-w-0 w-full">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-3">
                          <div className="overflow-hidden">
                            <h3 className="text-white font-semibold truncate">{capitalizeFirst(v.vaultName)}</h3>
                            <div className="text-sm text-[#A4A4A4] truncate">{v.token} • {shortenAddress(v.vaultPubkey)}</div>
                          </div>

                          <div className="text-right">
                            <div className="text-base md:text-lg font-bold text-[#27AAE1]">{apyLabel}</div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 mt-4 md:mt-0">
                            <Button
                              text="Withdraw"
                              color="dark"
                              onClick={() => {
                                setSelectedVault(v);
                                setWithdrawOpen(true);
                              }}
                            />
                          </div>
                        </div>

                        <div className="h-px w-full my-4 bg-[#292929df]"></div>

                        <div className="mt-3 flex items-center justify-between w-full text-sm text-[#A4A4A4]">
                          <div className="flex flex-col justify-center items-center">
                            <div className="text-xs">Invested</div>
                            <div className="font-semibold text-white flex flex-col justify-center items-center">
                              {v.amount.toFixed(2)} {v.token}
                              <span className="text-sm text-[#9A9A9A] text-center block mt-1">
                                {usdPrice != null ? `≈ $${usdValue.toFixed(2)}` : "-"}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-col justify-center items-center">
                            <div className="text-xs">PnL</div>
                            <div className="font-semibold text-green-500">+${Number(v.rewardsAccrued).toFixed(2)}</div>
                          </div>

                          <div className="flex flex-col justify-center items-center">
                            <div className="text-xs">Locked until</div>
                            <div className="font-semibold text-white">{v.lockedUntil ? lockedUntilReadable : "Flexible"}</div>
                          </div>

                          <div className="flex flex-col justify-center items-center">
                            <div className="text-xs">Status</div>
                            <div className={`font-semibold ${unlocked ? "text-green-300" : "text-orange-500"}`}>
                              {unlocked ? "Unlocked" : "Locked"}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex-1">
          <VaultsChart vaults={vaultList} />
        </div>
      </div>

      <div className="my-10">
        <TransactionsList
          pubKey={pubKey}
          tokens={tokens}
          showFilter={true}
          initialFilter="all"
          lsKeyPrefix="senti:txs:"
          onTransactionsChange={(txs) => {}}
        />
      </div>

      {/* WithdrawPanel receives vaultList, pubKey, open, onClose, onSuccess */}
      <WithdrawPanel
        open={withdrawOpen}
        onClose={() => {
          setWithdrawOpen(false);
          setSelectedVault(null);
        }}
        initialVault={selectedVault ?? undefined}
        vaults={vaultList}
        walletAddress={typeof pubKey === "string" ? pubKey : (pubKey && (pubKey as any).toString ? (pubKey as any).toString() : null)}
        onSuccess={async () => {
          setWithdrawOpen(false);
          await getVaultsForCurrentUser();
        }}
      />

      <ErrorModal
        isOpen={!!error}
        onClose={() => setError(null)}
        title="Failed to load vaults"
        message={error ?? "An error occurred"}
        onRetry={refresh}
      />
    </div>
  );
}

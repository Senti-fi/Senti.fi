// src/components/dashboard/WithdrawPanel.tsx
"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import Modal from "@/components/ui/Modal";
import ErrorModal from "@/components/ui/ErrorModal";
import Button from "@/components/Button";
import apiClient from "@/lib/apiClient";
import { shortenAddress } from "@/lib/helpers";
import { useRouter } from "next/navigation";

type Vault = {
  vaultName: string;
  vaultPubkey: string;
  token: string;
  amount: number;
  lockedUntil?: string | null;
  rewardsAccrued: number;
  usdPrice?: number | null;
  usdValue?: number;
  vaultPlanId?: string | null;
  vaultId?: string | null;
  userVaultId?: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  // optionally pre-select a vault
  initialVault?: Vault;
  // full list of vaults to choose from
  vaults: Vault[];
  // wallet address string
  walletAddress?: string | null;
  // callback to run after successful withdrawal (e.g. refresh vaults)
  onSuccess?: () => Promise<void> | void;
};

  const CLUSTER = process.env.NEXT_PUBLIC_SOLANA_CLUSTER || 'devnet';
  const explorerTxUrl = (txid: string) =>
    `https://explorer.solana.com/tx/${txid}?cluster=${CLUSTER}`;

export default function WithdrawPanel({ open, onClose, initialVault, vaults, walletAddress, onSuccess }: Props) {
  const [selectedVaultIndex, setSelectedVaultIndex] = useState<number>(-1);
  const [amount, setAmount] = useState<string>("0");
  const [agreeEarly, setAgreeEarly] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultTx, setResultTx] = useState<string | null>(null);
  const [serverSummary, setServerSummary] = useState<{ total?: number; rewards?: number; fee?: number } | null>(null);
  const prevOpenRef = useRef<boolean>(false);

  const router = useRouter();
    useEffect(() => {
      function onKey(e: KeyboardEvent) {
        if (e.key === 'Escape') {
          if (onClose) onClose();
          else router.push('/dashboard');
        }
      }
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
    }, [onClose, router]);

 // initialize once when panel opens (or when initialVault identity changes while open)
useEffect(() => {
  // if panel isn't open just clear prevOpen and skip
  if (!open) {
    prevOpenRef.current = false;
    return;
  }

  // only run initialization when we transition from closed -> open
  if (prevOpenRef.current) {
    // already initialized while open; do nothing
    return;
  }

  prevOpenRef.current = true;

  let idx = -1;

  if (initialVault) {
    const matchKeyPubkey = initialVault.vaultPubkey;
    const matchVaultId = initialVault.vaultId;
    const matchPlanId = initialVault.vaultPlanId;

    idx = vaults.findIndex((v) =>
      (matchVaultId && v.vaultId === matchVaultId) ||
      (matchPlanId && v.vaultPlanId === matchPlanId)
    );
  }

  if (idx === -1 && vaults.length > 0) idx = 0;

  setSelectedVaultIndex(idx);
  if (idx >= 0 && vaults[idx]) {
    setAmount(String(vaults[idx].amount ?? "0"));
  } else {
    setAmount(vaults.length ? String(vaults[0].amount ?? "0") : "0");
  }

  setAgreeEarly(false);
  setError(null);
  setProcessing(false);
  setConfirmOpen(false);
  setSuccessOpen(false);
  setResultTx(null);
  setServerSummary(null);

// run this effect when `open` toggles or when the identity of initialVault changes
}, [open, initialVault?.vaultPubkey, initialVault?.vaultId, initialVault?.vaultPlanId]);

// keep amount in sync only when user changes selected vault index
// useEffect(() => {
//   if (selectedVaultIndex >= 0 && selectedVaultIndex < vaults.length) {
//     setAmount(String(vaults[selectedVaultIndex].amount ?? "0"));
//   }
// }, [selectedVaultIndex, vaults]);

  const selectedVault = selectedVaultIndex >= 0 && selectedVaultIndex < vaults.length ? vaults[selectedVaultIndex] : null;

  // parsed amount
  const amountNum = useMemo(() => {
    const n = Number(String(amount || "0").replace(/,/g, ""));
    return Number.isFinite(n) ? n : 0;
  }, [amount]);

  // USD equivalent
  const usdEquivalent = useMemo(() => {
    if (!selectedVault || !selectedVault.usdPrice) return 0;
    return amountNum * selectedVault.usdPrice;
  }, [selectedVault, amountNum]);

  // pro-rated rewards for the requested withdrawal amount
  const proratedRewards = useMemo(() => {
    if (!selectedVault || !selectedVault.amount || selectedVault.amount <= 0) return 0;
    return (selectedVault.rewardsAccrued || 0);
  }, [selectedVault, amountNum]);

  // locked?
  const isLocked = useMemo(() => {
    if (!selectedVault || !selectedVault.lockedUntil) return false;
    try {
      return new Date() < new Date(selectedVault.lockedUntil);
    } catch {
      return false;
    }
  }, [selectedVault]);

  // fee (1% when locked)
  const fee = useMemo(() => {
    const total = amountNum + proratedRewards;
    return isLocked ? total * 0.01 : 0;
  }, [amountNum, proratedRewards, isLocked]);

  // total user will receive (approx)
  const totalReceive = useMemo(() => {
    return (amountNum + proratedRewards) - fee;
  }, [amountNum, proratedRewards, fee]);

  async function doWithdraw() {
    setError(null);

    if (!selectedVault) {
      setError("Choose a vault to withdraw from.");
      return;
    }
    if (!walletAddress) {
      setError("Wallet not connected. Please connect your wallet.");
      return;
    }
    if (!amountNum || amountNum <= 0) {
      setError("Enter a valid amount to withdraw.");
      return;
    }
    if (amountNum > selectedVault.amount) {
      setError("Requested amount exceeds deposited amount.");
      return;
    }
    // require agreement if locked
    if (isLocked && !agreeEarly) {
      setError("You must agree to the early-withdraw fee to proceed.");
      return;
    }

    // show processing
    setProcessing(true);
    setError(null);

    try {
      const payload = {
        vaultPlanId: selectedVault.vaultPlanId ?? selectedVault.vaultId ?? null,
        token: selectedVault.token,
        amount: amountNum,
        walletAddress,
      };

      // call backend withdraw (server will sign & send)
      const resp = await apiClient.post("/api/withdraw", payload);
      const txHash = resp?.data?.txHash ?? null;
      const summary = resp?.data?.summary ?? null;
      setResultTx(txHash || null);
      if (summary) setServerSummary({ total: summary.total, rewards: summary.rewards, fee: summary.fee });

      // show success confirmation modal
      setSuccessOpen(true);
      // optionally run onSuccess (refresh)
      if (typeof onSuccess === "function") {
        await onSuccess();
      }
    } catch (err: any) {
      console.error("Withdraw error", err);
      const backendErr = err?.response?.data?.error ?? err?.message ?? String(err);
      setError(backendErr);
    } finally {
      setProcessing(false);
    }
  }

   const panelClass = useMemo(
      () =>
        `absolute top-0 right-0 h-full bg-zinc-900 text-white shadow-xl rounded-tl-2xl rounded-bl-2xl transform transition-transform duration-300
         ${open ? 'translate-x-0' : 'translate-x-full'}
         w-full md:w-[400px] lg:w-[400px]`,
      [open]
    );

  return (
        <>
            <div
                className={`fixed inset-0 z-50 ${open ? 'pointer-events-auto' : 'pointer-events-none'} `}
                aria-hidden={!open}
            >
                {/* Backdrop + blur */}
                <div
                    onClick={() => (onClose ? onClose() : router.push('/dashboard'))}
                    className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity  ${open ? 'opacity-90' : 'opacity-0'}`}
                />

                {/* Panel */}
                <div className={panelClass} role="dialog" aria-modal="true">
                    <div className="h-full flex flex-col">
                        <div className="p-4 pb-6 flex items-center justify-between ">
                            <div>
                                <h3 className="text-lg font-bold">Withdraw from vault</h3>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => (onClose ? onClose() : router.push('/dashboard'))}
                                    className="p-0.5    rounded-full hover:bg-white/5 border border-white"
                                    aria-label="Close"
                                >
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                                        <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-5">
                            <div className="text-left">

                                <div className="space-y-6">
                                    <div className="mb-5">
                                        <label className="block text-sm text-[#A4A4A4] mb-2">Vault</label>
                                        <select
                                            className="w-full bg-[#111111] text-white p-2 rounded-md "
                                            value={selectedVaultIndex}
                                            onChange={(e) => setSelectedVaultIndex(Number(e.target.value))}
                                            aria-label="Select vault"
                                        >
                                            {vaults.length === 0 && <option value={-1}>No vaults</option>}
                                            {vaults.map((v, i) => (
                                                <option key={v.vaultPubkey} value={i}>
                                                    {v.vaultName} • {v.token}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="flex gap-5  items-center">
                                        <div className="flex-1">
                                            <div className="flex justify-between items-center mb-2">
                                                <label className="text-sm text-[#A4A4A4]">Amount ({selectedVault?.token ?? ""})</label>
                                                <p className="text-sm text-[#A4A4A4] ">Available: {selectedVault?.amount.toFixed(2)} {selectedVault?.token} </p>
                                            </div>
                                            <div className="flex items-center relative">
                                                <input
                                                type="number"
                                                min={0}
                                                step="any"
                                                value={amount}
                                                onChange={(e) => setAmount(e.target.value)}
                                                className="w-full bg-[#111111] text-white p-2 rounded-md"
                                                />
                                                <div className="absolute right-2 flex items-center gap-1">
                                                    <div className="text-xs text-[#A4A4A4]"> ≈  {selectedVault?.usdPrice ? `$${(usdEquivalent || 0).toFixed(2)}` : "—"}</div>
                                                </div>
                                            </div>
                                        </div>

                                    </div>

                                    <div className=" bg-[#111111] space-y-3 rounded-md p-5">
                                        <div className="flex text-sm text-[#9A9A9A] justify-between items-center">
                                            <div>Rewards</div>
                                            <div className="font-semibold text-sm text-white">{proratedRewards.toFixed(2)} {selectedVault?.token ?? ""}</div>
                                        </div>
                                        <div className="flex text-sm text-[#9A9A9A] justify-between items-center">
                                            <div>Fee</div>
                                            <div className="font-semibold text-sm text-white">{fee ? `${fee.toFixed(4)} ${selectedVault?.token ?? ""}` : `0`}</div>
                                        </div>
                                        <div className="flex text-sm text-[#9A9A9A] justify-between items-center">
                                            <div>Rewards</div>
                                            <div className="font-semibold text-sm text-white">{totalReceive.toFixed(4)} {selectedVault?.token ?? ""} </div>
                                        </div>
                                    </div>

                                    {isLocked && (
                                        <div className="mt-3 bg-[#111111] p-3 rounded-md">
                                            <div className="text-sm text-[#A4A4A4] mb-2">This vault is still locked, early withdrawal incurs a 1% fee.</div>
                                            <label className="inline-flex items-center gap-2">
                                                <input type="checkbox" checked={agreeEarly} onChange={(e) => setAgreeEarly(e.target.checked)} />
                                                <span className="text-sm">I agree to pay the 1% early withdrawal fee</span>
                                            </label>
                                        </div>
                                    )}

                                    {error && <div className="text-red-400 mt-2">{error}</div>}
                                </div>

                                <div className="mt-6 w-full">
                                    <Button
                                        text={processing ? "Processing..." : "Withdraw"}
                                        color="blue"
                                        onClick={() => setConfirmOpen(true)}
                                        disabled={processing || !selectedVault || amountNum <= 0 || (isLocked && !agreeEarly)}
                                        otherstyles="w-full"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {/* confirmation modal */}
            <Modal isOpen={confirmOpen} onClose={() => setConfirmOpen(false)}>
                <div className="text-center">
                    <h3 className="text-2xl font-semibold text-white mb-2">Confirm withdrawal</h3>
                    <p className="text-sm font-semibold text-[#A4A4A4] mb-4">
                        Withdraw {amountNum} {selectedVault?.token} {selectedVault ? `from ${selectedVault.vaultName}` : ""}? <br />
                        {isLocked ? " Early withdrawal fee (1%) will apply" : ""}
                    </p>

                  <div className=" bg-[#111111] space-y-3 rounded-md mb-6 p-5">
                      <div className="flex text-sm text-[#9A9A9A] justify-between items-center">
                          <div>Rewards</div>
                          <div className="font-semibold text-sm text-white">{proratedRewards.toFixed(2)} {selectedVault?.token ?? ""}</div>
                      </div>
                      <div className="flex text-sm text-[#9A9A9A] justify-between items-center">
                          <div>Fee</div>
                          <div className="font-semibold text-sm text-white">{fee ? `${fee.toFixed(4)} ${selectedVault?.token ?? ""}` : `0`}</div>
                      </div>
                      <div className="flex text-sm text-[#9A9A9A] justify-between items-center">
                          <div>Rewards</div>
                          <div className="font-semibold text-sm text-white">{totalReceive.toFixed(4)} {selectedVault?.token ?? ""} </div>
                      </div>
                  </div>

                    <div className="flex gap-3 justify-center">
                        <Button text="Cancel" color="dark" onClick={() => setConfirmOpen(false)} />
                        <Button text="Confirm & Withdraw" color="blue" onClick={() => { setConfirmOpen(false); void doWithdraw(); }} />
                    </div>
                </div>
            </Modal>

            {/* processing modal */}
            <Modal isOpen={processing} onClose={() => { }}>
                <div className="text-center">
                    <div className="mx-auto w-16 h-16 border-8 border-t-transparent rounded-full animate-spin border-[#005CE6] mb-6" />
                    <h3 className="text-lg font-semibold text-white mb-2">Processing withdrawal</h3>
                    <p className="text-sm text-[#A4A4A4]">Submitting your request. Please wait.</p>
                </div>
            </Modal>

            {/* success modal */}
            <Modal isOpen={successOpen} onClose={() => { setSuccessOpen(false); onClose(); }}>
                <div className="text-center">
                  <div className="flex justify-center mb-4">
                      <div className="w-16 h-16 bg-[#005CE6] rounded-full flex items-center justify-center">
                          <svg className="w-10 h-10 text-black" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M16.707 5.293a1 1 0 00-1.414-1.414L8 11.172 4.707 7.879A1 1 0 003.293 9.293l4 4a1 1 0 001.414 0l8-8z" />
                          </svg>
                      </div>
                  </div>
                    <h3 className="text-2xl font-semibold text-white mb-2">Withdrawal Successful</h3>
                    {resultTx && (
                        <div className="mb-4">
                            <a
                                href={explorerTxUrl(resultTx)}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-block px-4 py-2 underline text-[#A4A4A4] text-xs transition"
                            >
                                View on Explorer
                            </a>
                        </div>
                    )}
                    
                    <div className="flex gap-3 justify-center">
                        <Button text="Return to Vaults" color="blue" onClick={() => { setSuccessOpen(false); onClose(); }} />
                    </div>
                </div>
            </Modal>

            {/* error modal */}
            <ErrorModal
                isOpen={!!error && !processing}
                onClose={() => setError(null)}
                title="Withdrawal failed"
                message={error ?? "An unexpected error occurred"}
                onRetry={() => {
                    setError(null);
                }}
            />
        </>
    );
}

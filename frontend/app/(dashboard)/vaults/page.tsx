// src/app/save/page.tsx
"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import apiClient from "@/lib/apiClient"; // ensure baseURL -> http://localhost:9000
import Button from "@/components/Button";
import TokenSelector from "@/components/TokenSelector";
import { useSendTransaction } from "@/hooks/useSendTransaction";
import Modal from "@/components/ui/Modal";
import ErrorModal from "@/components/ui/ErrorModal";
import { shortenAddress, capitalizeFirst, explorerTxUrl } from "@/lib/helpers";
import { useRouter } from "next/navigation";
import VaultBalance from "@/components/dashboard/vaultBalance";
import { useWalletBalancesRealtime } from "@/hooks/useWalletBalancesRealtime";

type VaultPlanRaw = {
  id: string;
  name: string;
  description?: string | null;
  riskType?: string | null;
  apy?: number | null; // decimal e.g. 0.12
  minLockDays?: number | null;
  minDeposit?: number | null;
  isActive?: boolean;
  createdAt?: string;
  vaults?: any[];
  vaultPubkey: string;
  
};
 type LastAttempt = {
  token: string;
  amount: number;
  vaultPlanId: string;
  recipient: string;
  txid?: string;         // populated when on-chain send succeeded
  deposited?: boolean;   // true when deposit endpoint succeeded
};


export default function SavePage() {
  const router = useRouter();
  const [vaultPlans, setVaultPlans] = useState<VaultPlanRaw[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [selectedToken, setSelectedToken] = useState<"SOL" | "USDC" | "USDT" | string | null>(null);
  const [selectedTokenBal, setSelectedTokenBal] = useState<string>("0.00");

  // Token amount (in token units). This is what user types.
  const [tokenAmount, setTokenAmount] = useState<string>("0"); // token units as string
  const [lastTypedTokenAmount, setLastTypedTokenAmount] = useState<string>("0"); // preserve raw input

  // USD equivalent is derived (tokenAmount * price)
  const [usdOverride, setUsdOverride] = useState<number | null>(null); // optional override if needed

  // modals + flow state
  const [processingOpen, setProcessingOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);

  const [lastTxId, setLastTxId] = useState<string | null>(null);
  const [lastResultDetails, setLastResultDetails] = useState<{ amount: number; token: string; recipient: string } | null>(null);
  const [resultMsg, setResultMsg] = useState<string | null>(null);

const lastAttemptRef = useRef<LastAttempt | null>(null);


  const { send, loading: sendLoading, error: sendError } = useSendTransaction();

  // get wallet prices & tokens (we need the token price and decimals)
  const {
    prices,
    bySymbol,
    solBalance,
    tokens: walletTokens,
    loading: balancesLoading,
  } = useWalletBalancesRealtime("https://api.devnet.solana.com");

  // --- fetch plans ---
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    apiClient
      .get("/api/vaultsplan")
      .then((resp) => {
        if (!mounted) return;
        const plans = (resp.data?.vaultPlans ?? []) as VaultPlanRaw[];
        const activePlans = plans.filter((p) => p.isActive);
        setVaultPlans(activePlans);

        if (activePlans.length > 0) setSelectedPlanId((prev) => prev ?? activePlans[0].id);
      })
      .catch((err) => {
        console.error("Failed to fetch vault plans", err);
        if (!mounted) return;
        setError(err?.response?.data?.error ?? err.message ?? "Failed to load plans");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const savingsPlans = useMemo(() => {
    if (!vaultPlans) return [];
    return vaultPlans.map((p) => {
      const apyPercent =
        typeof p.apy === "number" ? `${(p.apy * 100).toFixed(2).replace(/\.00$/, "")}% APY` : "—";
      return {
        id: p.id,
        name: capitalizeFirst(p.name),
        description: capitalizeFirst(p.description ?? ""),
        apyLabel: apyPercent,
        minDepositLabel: p.minDeposit != null ? `$${p.minDeposit}` : "—",
        minLockDaysLabel: p.minLockDays != null ? `${p.minLockDays} days` : "Flexible",
        risk: p.riskType ?? "Unknown",
        selected: selectedPlanId === p.id,
      };
    });
  }, [vaultPlans, selectedPlanId]);

  const chosenPlan = useMemo(() => vaultPlans?.find((p) => p.id === selectedPlanId) ?? null, [vaultPlans, selectedPlanId]);

  // helper: format numbers
  const fmt = (v: number | null | undefined, digits = 2) => {
    if (v == null || Number.isNaN(v)) return "0.00";
    return v.toFixed(digits);
  };

  // ----- Price lookup helpers -----
  function getPriceForSymbol(sym?: string) {
    if (!sym) return null;
    const key = sym.toUpperCase();

    // 1) direct pyth price keyed by symbol
    const pythEntry = (prices as any)?.[key] as any;
    if (pythEntry && typeof pythEntry.price === "number") return pythEntry.price;

    // 2) aggregated map price
    const agg = (bySymbol as any)?.[key] as any;
    if (agg && typeof agg.usdPrice === "number") return agg.usdPrice;

    // 3) try to find by matching raw.priceId etc (less likely here). fallback null.
    return null;
  }

  // find decimals for selectedToken (for rounding), default to 6
  const getDecimalsForSymbol = (sym?: string) => {
    if (!sym) return 6;
    const key = sym.toUpperCase();
    if (key === "SOL") {
      // SOL uses 9 decimals
      return 9;
    }
    // search walletTokens for matching symbol or mint
    const found = (walletTokens || []).find((t: any) => {
      const tokenSymbol = (t.tokenSymbol || t.symbol || "").toUpperCase();
      if (tokenSymbol && tokenSymbol === key) return true;
      if (t.mint && t.mint === (selectedToken as string)) return true;
      return false;
    });
    return found?.decimals ?? 6;
  };

  // USD equivalent derived from tokenAmount and price
  const selectedTokenPrice = useMemo(() => getPriceForSymbol(selectedToken ?? undefined), [prices, bySymbol, selectedToken]);
  const selectedTokenDecimals = useMemo(() => getDecimalsForSymbol(selectedToken ?? undefined), [walletTokens, selectedToken]);

  const usdEquivalent = useMemo(() => {
    const amt = Number(tokenAmount || "0");
    if (!selectedTokenPrice || Number.isNaN(amt)) return 0;
    return amt * selectedTokenPrice;
  }, [tokenAmount, selectedTokenPrice]);

  // quickAmounts are USD values — convert each to token amount using price
  const quickAmounts = [50, 100, 150, 200];

  function onQuickAmountUsdClick(usd: number) {
    setError(null);
    if (!selectedToken) {
      setError("Choose a token first");
      return;
    }
    if (!selectedTokenPrice || typeof selectedTokenPrice !== "number") {
      setError("Price unavailable for selected token");
      return;
    }
    // compute token units = usd / price
    const tokenUnits = usd / selectedTokenPrice;
    // round to reasonable decimals (based on token decimals)
    const dec = Math.min(Math.max(selectedTokenDecimals ?? 6, 0), 9);
    const tokenStr = Number(tokenUnits).toFixed(dec);
    setTokenAmount(tokenStr);
    setLastTypedTokenAmount(tokenStr);
    setUsdOverride(usd); // store the USD quick amount
  }

  // when user types token amount directly, update tokenAmount and clear usdOverride
  function onTokenAmountChange(v: string) {
    // allow numbers and decimals
    setLastTypedTokenAmount(v);
    // sanitize: replace commas, trim
    const cleaned = v.replace(/,/g, "").trim();
    // keep it as-is for the input but only set tokenAmount when valid number
    const n = Number(cleaned);
    if (!cleaned || Number.isNaN(n)) {
      // keep tokenAmount as "0" so calculations show 0 USD
      setTokenAmount("0");
      setUsdOverride(null);
    } else {
      // limit decimals to token decimals
      const dec = Math.min(Math.max(selectedTokenDecimals ?? 2, 0), 2);
      setTokenAmount(n.toFixed(dec));
      setUsdOverride(null);
    }
  }

  // calculate earnings & totals in USD (use USD equivalents)
  const calculateEarnings = useMemo(() => {
    return () => {
      const usdAmt = usdEquivalent || 0;
      const apy = chosenPlan?.apy ?? 0.08;
      const days = chosenPlan?.minLockDays ?? 7;
      // apy is decimal, we want daily percentage
      const dailyRatePercent = (apy * 100) / 365;
      const earnings = (usdAmt * dailyRatePercent * days) / 100;
      return earnings.toFixed(2);
    };
  }, [usdEquivalent, chosenPlan]);

  const totalReturn = useMemo(() => {
    return () => {
      const usdAmt = usdEquivalent || 0;
      const earnings = parseFloat(calculateEarnings());
      return (usdAmt + earnings).toFixed(2);
    };
  }, [usdEquivalent, calculateEarnings]);

  // helper to get vault pubkey
  function getVaultPubkeyForPlan(plan: VaultPlanRaw | null): string | null {
    if (!plan) return null;
    if (plan.vaultPubkey) return plan.vaultPubkey;
    if (Array.isArray(plan.vaults) && plan.vaults.length > 0 && plan.vaults[0]?.vaultPubkey) {
      return plan.vaults[0].vaultPubkey!;
    }
    return null;
  }

  function resetFlow() {
    setSelectedToken(null);
    setSelectedTokenBal("0.00");
    setTokenAmount("0");
    setLastTypedTokenAmount("0");
    setUsdOverride(null);
    setLastTxId(null);
    setLastResultDetails(null);
    setResultMsg(null);
    lastAttemptRef.current = null;
  }

  // run deposit: token amount should be token units (number), recipient vaultPubkey
// run deposit: token amount should be token units (number), recipient vaultPubkey
async function runDepositFlow(params: { token: string; amount: number; vaultPlanId: string; recipient: string }) {
  setProcessingOpen(true);
  setError(null);
  setResultMsg(null);

  // ensure lastAttemptRef always reflects the attempt (so retry can read it)
  lastAttemptRef.current = {
    token: params.token,
    amount: params.amount,
    vaultPlanId: params.vaultPlanId,
    recipient: params.recipient,
    txid: undefined,
    deposited: false,
  };

  try {
    const sendResult = await send({
      token: params.token as "SOL" | "USDC" | "USDT",
      amount: params.amount,
      recipient: params.recipient,
    });

    if (!sendResult.success) {
      // send failed — we set result and throw so UI shows error; retry should try full flow
      const errMsg = sendResult.error ?? "On-chain transfer failed";
      setResultMsg(errMsg);
      throw new Error(errMsg);
    }

    // send succeeded — record txid so retry can attempt deposit-only if needed
    const txid = sendResult.txid;
    if (lastAttemptRef.current) lastAttemptRef.current.txid = txid;

    // attempt deposit endpoint call
    try {
      await apiClient.post("/api/deposit", {
        token: params.token,
        amount: params.amount,
        vaultPlanId: params.vaultPlanId,
        txHash: txid,
      });

      // deposit succeeded
      if (lastAttemptRef.current) lastAttemptRef.current.deposited = true;

      setProcessingOpen(false);
      setSuccessOpen(true);
      setLastTxId(txid as string);
      setLastResultDetails({ amount: params.amount, token: params.token, recipient: params.recipient });
      return { success: true, txid };
    } catch (depositErr: any) {
      // deposit endpoint failed but token was already sent on-chain. Let retry attempt deposit-only.
      const depositMsg = depositErr?.response?.data ?? depositErr?.message ?? String(depositErr);
      setResultMsg(String(depositMsg));
      setErrorOpen(true);
      setProcessingOpen(false);
      return { success: false, error: depositMsg, txid };
    }
  } catch (err: any) {
    // overall failure (send failure or other). Make sure state is set for UI.
    console.error("runDepositFlow error", err);
    setProcessingOpen(false);

    const message = err?.message ?? String(err) ?? "Transaction failed";
    setResultMsg(message);
    setErrorOpen(true);
    return { success: false, error: message };
  }
}

  async function handleStartSaving() {
    setError(null);

    if (!chosenPlan) {
      setError("Please select a plan");
      return;
    }
    if (!selectedToken) {
      setError("Please select a token");
      return;
    }

    const tokenAmtNum = Number(tokenAmount);
    if (!tokenAmtNum || Number.isNaN(tokenAmtNum) || tokenAmtNum <= 0) {
      setError("Please enter a valid token amount");
      return;
    }

    // require price to compute USD equivalent
    if (!selectedTokenPrice || typeof selectedTokenPrice !== "number") {
      setError("Token price is unavailable. Try again in a moment.");
      return;
    }

    const usdValue = tokenAmtNum * selectedTokenPrice;
    const minDeposit = chosenPlan?.minDeposit ?? 0;

    // if (usdValue < (minDeposit ?? 0)) {
    //   setError(`Minimum deposit for this plan is $${minDeposit}. Your selected amount is $${fmt(usdValue)}.`);
    //   return;
    // }

    const vaultPubkey = getVaultPubkeyForPlan(chosenPlan);
    if (!vaultPubkey) {
      setError("Vault recipient address is not available. Please try again later.");
      return;
    }

    lastAttemptRef.current = {
      token: selectedToken,
      amount: tokenAmtNum,
      vaultPlanId: chosenPlan.id,
      recipient: vaultPubkey,
    };

    await runDepositFlow(lastAttemptRef.current);
  }

  async function handleRetry() {
  const last = lastAttemptRef.current;
  if (!last) {
    setResultMsg("Nothing to retry");
    return;
  }

  setErrorOpen(false);
  setError(null);
  setResultMsg(null);

  // If we already have an on-chain txid but deposit wasn't recorded as completed,
  // try to call the deposit endpoint again (deposit-only retry).
  if (last.txid && !last.deposited) {
    try {
      setProcessingOpen(true);
      const resp = await apiClient.post("/api/deposit", {
        token: last.token,
        amount: last.amount,
        vaultPlanId: last.vaultPlanId,
        txHash: last.txid,
      });

      // deposit resumed and succeeded
      lastAttemptRef.current = { ...last, deposited: true };
      setProcessingOpen(false);
      setSuccessOpen(true);
      setLastTxId(last.txid as string);
      setLastResultDetails({ amount: last.amount, token: last.token, recipient: last.recipient });
      return;
    } catch (err: any) {
      console.error("deposit-only retry failed", err);
      setProcessingOpen(false);
      const message = err?.response?.data?.error ?? err?.message ?? String(err);
      setResultMsg(String(message));
      setErrorOpen(true);
      return;
    }
  }

  // Otherwise, re-run the entire flow (send + deposit)
  try {
    setProcessingOpen(true);
    await runDepositFlow({
      token: last.token,
      amount: last.amount,
      vaultPlanId: last.vaultPlanId,
      recipient: last.recipient,
    });
  } finally {
    setProcessingOpen(false);
  }
}

  // UI helpers
  const displayUsdEquivalent = usdEquivalent || 0;
  const displayTokenAmount = lastTypedTokenAmount ?? tokenAmount ?? "0";

  // text for start button: show USD amount when available
  const btnUsd = displayUsdEquivalent ? `$${fmt(displayUsdEquivalent)}` : `$0.00`;

  const isActionDisabled = sendLoading || processingOpen || balancesLoading || !selectedToken || !selectedTokenPrice;

  return (
    <div className="flex-1 p-4 md:p-6 overflow-y-auto">
      <VaultBalance />

      <div className="mb-6 md:mb-8">
        <h2 className="text-xl md:text-2xl font-bold text-white mb-4 md:mb-6">Choose Your Plan</h2>

        {loading ? (
          <div className="text-center text-white py-6">Loading plans…</div>
        ) : savingsPlans.length === 0 ? (
          <div className="text-center text-white py-6">No active plans available.</div>
        ) : (
          <div className="space-y-3 md:space-y-4">
            {savingsPlans.map((plan) => (
              <div
                key={plan.id}
                className={`bg-[#292929] rounded-2xl p-3 md:p-6 w-full cursor-pointer transition-all ${plan.selected ? "ring-2 ring-[#27AAE1]" : "hover:bg-[#333333]"}`}
                onClick={() => setSelectedPlanId(plan.id)}
              >
                <div className=" w-full">
                  <div className="flex items-start w-full  space-x-2">
                    <div className="flex items-center mt-2">
                      <div className={`w-5 h-5 rounded-full border-2 ${plan.selected ? "border-[#27AAE1] bg-[#27AAE1]" : "border-[#27AAE1]"}`}>
                        {plan.selected && <div className="w-2 h-2 bg-white rounded-full mx-auto mt-1" />}
                      </div>
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="flex gap-2">
                          <h3 className="text-white font-semibold text-sm md:text-lg">{plan.name}</h3>
                          <span className="px-2 py-1 rounded-full text-xs max-md:text-[9px] font-medium text-white bg-gray-500">Plan</span>
                        </div>
                        <div className="text-right">
                          <div className="text-base md:text-2xl font-bold text-[#27AAE1]">{plan.apyLabel}</div>
                        </div>
                      </div>
                      <p className="text-[#A4A4A4] text-sm max-md:text-xs mb-3">{plan.description}</p>
                      <div className="flex items-center gap-6 text-sm max-md:text-xs text-[#A4A4A4]">
                        <div>Min: {plan.minDepositLabel}</div>
                        <div>Lock: {plan.minLockDaysLabel}</div>
                        <div>Risk: {plan.risk}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* token selection */}
      <div className="mb-6 md:mb-8">
        <p className="text-xl md:text-2xl font-bold text-white mb-4 md:mb-6">Select Token</p>

        <div className="bg-[#111111] rounded-xl p-3">
          <TokenSelector
            supportedTokens={["SOL", "USDC", "USDT"]}
            showSearch
            onSelect={(sym, bal) => {
              setSelectedToken(sym);
              setSelectedTokenBal(bal);
              // reset amounts on token change
              setTokenAmount("0");
              setLastTypedTokenAmount("0");
              setUsdOverride(null);
            }}
          />
        </div>
      </div>

      <div className="mb-6 md:mb-8">
        <h2 className="text-xl md:text-2xl font-bold text-white mb-4 md:mb-6">How much {selectedToken ?? ""} do you want to save?</h2>

        <div className="bg-[#292929] rounded-2xl p-4 md:p-6 mb-4 md:mb-6">
          <div className="flex flex-col md:gap-6 mb-4">
            <div className="flex flex-col">
              <div className="mb-2">
                <div className="inline-flex items-center bg-transparent rounded-md">
                  <input
                    type="tel"
                    value={displayTokenAmount}
                    onChange={(e) => onTokenAmountChange(e.target.value)}
                    className="bg-transparent text-white text-xl md:text-3xl font-bold placeholder-[#A4A4A4] focus:outline-none w-28 md:w-40"
                    placeholder="0.00"
                    inputMode="decimal"
                    aria-label="Token amount"
                  />
                </div>
              </div>

                <div className="text-sm text-[#9A9A9A]">
                  ≈ {selectedTokenPrice ? `$${fmt(displayUsdEquivalent, 2)}` : "$0.00"}
                </div>
             
              
            </div>

            <div className="mt-3 md:mt-0 flex gap-2">
              {quickAmounts.map((amount) => (
                <button
                  key={amount}
                  onClick={() => onQuickAmountUsdClick(amount)}
                  className="rounded-xl p-3 px-6 text-center transition-colors bg-[#181717] text-[#A4A4A4] hover:bg-[#444444] hover:text-white"
                >
                  <span className="font-medium text-sm md:text-base">${amount}</span>
                </button>
              ))}
            </div>

          </div>
            <div className="text-xs text-[#A4A4A4]">
              Your balance: {selectedToken === "SOL" ? `${fmt(solBalance ?? 0, 4)} SOL` : `${selectedTokenBal} ${selectedToken ?? ""}`}
            </div>

          
        </div>
      </div>

      <div className="bg-[#292929] rounded-2xl p-4 md:p-6 mb-6 md:mb-8">
        <h2 className="text-xl md:text-2xl font-bold text-white mb-4 md:mb-6">Summary</h2>

        <div className="space-y-3 md:space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-[#A4A4A4]">You save (token):</span>
            <span className="text-white font-semibold">{tokenAmount} {selectedToken ?? ""}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-[#A4A4A4]">Equivalent (USD):</span>
            <span className="text-white font-semibold">${fmt(displayUsdEquivalent, 2)}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-[#A4A4A4]">Duration:</span>
            <span className="text-white font-semibold">{chosenPlan?.minLockDays ?? 7} days</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-[#A4A4A4]">You earn (USD est.):</span>
            <span className="text-white font-semibold">+${calculateEarnings()}</span>
          </div>

          <div className="border-t border-[#333333] pt-3 md:pt-4">
            <div className="flex justify-between items-center">
              <span className="text-white font-bold text-base md:text-lg">Total return (USD est.):</span>
              <span className="text-white font-bold text-lg md:text-xl">${totalReturn()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* action */}
      <div className="mb-12">
        <div className="space-y-3">
          {error && <div className="text-red-400">{error}</div>}
          {sendError && <div className="text-red-400">Send error: {sendError}</div>}
          <Button
            text={sendLoading || processingOpen ? "Processing..." : `Start Saving ${btnUsd}`}
            color="blue"
            onClick={handleStartSaving}
            disabled={isActionDisabled || Number(tokenAmount) <= 0}
          />
        </div>
      </div>

      {/* Processing Modal */}
      <Modal isOpen={processingOpen} onClose={() => {}}>
        <div className="text-center">
          <div className="mx-auto w-16 h-16 border-8 border-t-transparent border-b-transparent border-l-transparent rounded-full animate-spin border-[#005CE6] mb-6" />
          <h3 className="text-xl font-semibold text-white mb-4">Processing your transaction</h3>
          <p className="text-sm text-[#A4A4A4]">Preparing and broadcasting your transaction. This may take a few seconds.</p>
        </div>
      </Modal>

      {/* Success Modal */}
      <Modal isOpen={successOpen} onClose={() => setSuccessOpen(false)}>
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-[#005CE6] rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-black" fill="currentColor" viewBox="0 0 20 20">
                <path d="M16.707 5.293a1 1 0 00-1.414-1.414L8 11.172 4.707 7.879A1 1 0 003.293 9.293l4 4a1 1 0 001.414 0l8-8z" />
              </svg>
            </div>
          </div>

          <h3 className="text-2xl font-bold text-white mb-2">Deposit Successful!</h3>
          <p className="text-sm text-[#A4A4A4] mb-4">
            {lastResultDetails
              ? `Deposited ${lastResultDetails.amount} ${lastResultDetails.token} to ${chosenPlan?.name} plan.`
              : "Transaction successful."}
          </p>

          {lastTxId && (
            <div className="mb-4">
              <a href={explorerTxUrl(lastTxId)} target="_blank" rel="noreferrer" className="inline-block px-4 py-2 underline text-[#A4A4A4] text-xs transition">
                View on Explorer
              </a>
            </div>
          )}

          <div className="mt-6 space-y-3 flex flex-col w-full">
            <Button
              text="Deposit again"
              color="blue"
              onClick={() => {
                setSuccessOpen(false);
                resetFlow();
              }}
            />
            <Button
              text="View my savings"
              color="dark"
              onClick={() => {
                router.push("/myvaults");
              }}
            />
          </div>
        </div>
      </Modal>

      {/* Error Modal */}
      <ErrorModal
        isOpen={errorOpen}
        onClose={() => setErrorOpen(false)}
        onRetry={handleRetry}
        title="Deposit failed"
        message={resultMsg ?? "An error occurred while sending transaction."}
        hint={sendError ?? undefined}
      />
    </div>
  );
}

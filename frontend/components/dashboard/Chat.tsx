"use client";

import React, { useEffect, useRef, useState } from "react";
import { RobotIcon, SendIcon } from "../icons/svgs";
import { useAuth } from "@/context/AuthContext";
import apiClient from "@/lib/apiClient"; // make sure this exists (same as SavePage)
import { useSendTransaction } from "@/hooks/useSendTransaction"; // reuse send hook
import Button from "../Button";
import Modal from "../ui/Modal";

export type ChatMessage = {
  id: string;
  role: "user" | "ai";
  text: string;
  createdAt: string;
};

/**
 * Chat component
 * - shows messages (AI left, user right)
 * - input at bottom
 * - typing simulation while waiting for response
 * - posts to /api/chat (if available) otherwise shows dummy response
 * - recognizes action_intent:
 *     - DEPOSIT_VAULT -> inline deposit UI (reuses previous deposit flow)
 *     - SWAP_TOKENS   -> inline swap confirmation UI (simulated)
 */

export default function Chat() {
  const { user, token } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  // deposit-intent state
  const [intentActive, setIntentActive] = useState(false);
  const [intentToken, setIntentToken] = useState<string | null>(null);
  const [intentAmount, setIntentAmount] = useState<number | null>(null);
  const [intentVaultPlanId, setIntentVaultPlanId] = useState<string | null>(null);
  const [intentVaultPubkey, setIntentVaultPubkey] = useState<string | null>(null);
  const [vaultPlans, setVaultPlans] = useState<any[] | null>(null);

  const [depositProcessing, setDepositProcessing] = useState(false);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [depositSuccessTx, setDepositSuccessTx] = useState<string | null>(null);

  // send hook (same as SavePage)
  const { send, loading: sendLoading, error: sendError } = useSendTransaction();

  // swap-intent state (NEW)
  const [swapActive, setSwapActive] = useState(false);
  const [swapFrom, setSwapFrom] = useState<string | null>(null);
  const [swapTo, setSwapTo] = useState<string | null>(null);
  const [swapAmount, setSwapAmount] = useState<number | null>(null);
  const [swapProcessing, setSwapProcessing] = useState(false);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [swapSuccessTx, setSwapSuccessTx] = useState<string | null>(null);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing, intentActive, swapActive]);

  function addMessage(msg: ChatMessage) {
    setMessages((m) => [...m, msg]);
  }

  // fetch vault plans — used when AI intent doesn't include vault info
  async function fetchVaultPlans() {
    try {
      const resp = await apiClient.get("/api/vaultsplan", {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const plans = resp.data?.vaultPlans ?? [];
      const active = (plans as any[]).filter((p) => p.isActive);
      setVaultPlans(active);
      return active;
    } catch (err) {
      console.warn("Failed to fetch vault plans for intent:", err);
      setVaultPlans([]);
      return [];
    }
  }

  // Called when AI reply contains an action_intent. Parses and prepares inline deposit or swap UI.
  async function handleAiResponse(aiRaw: any, aiText: string) {
    // add AI message to chat
    const aiMsg: ChatMessage = {
      id: `a_${Date.now()}`,
      role: "ai",
      text: aiText,
      createdAt: new Date().toISOString(),
    };
    addMessage(aiMsg);

    // check for action_intent shape
    const intent = aiRaw?.action_intent ?? aiRaw?.actionIntent ?? null;
    if (!intent) return;

    const type = intent.action_type ?? intent.actionType ?? null;

    // --- DEPOSIT_VAULT intent (existing) ---
    if (type === "DEPOSIT_VAULT") {
      const token = (intent.token ?? intent.token_symbol ?? null)?.toString().toUpperCase() ?? null;
      const amount = typeof intent.amount === "number" ? intent.amount : intent.amount ? Number(intent.amount) : null;
      const targetPlanId = intent.target_vault_id ?? intent.targetVaultId ?? null;
      const targetPubkey = intent.target_vault_pubkey ?? intent.targetVaultPubkey ?? null;

      setIntentToken(token);
      setIntentAmount(amount ?? null);
      setIntentVaultPlanId(targetPlanId ?? null);
      setIntentVaultPubkey(targetPubkey ?? null);
      setIntentActive(true);
      setDepositError(null);
      setDepositSuccessTx(null);

      if (!targetPlanId && !targetPubkey) {
        const plans = await fetchVaultPlans();
        if (plans.length > 0) {
          const first = plans[0];
          setIntentVaultPlanId(first.id ?? null);
          const pub = first.vaultPubkey ?? (Array.isArray(first.vaults) && first.vaults[0]?.vaultPubkey) ?? null;
          setIntentVaultPubkey(pub);
        } else {
          setDepositError("AI requested a vault deposit but no vault plans are available. Try again later or create a plan first.");
        }
      } else {
        if (targetPlanId && !targetPubkey) {
          const plans = vaultPlans ?? (await fetchVaultPlans());
          const found = (plans || []).find((p: any) => p.id === targetPlanId);
          if (found) {
            const pub = found.vaultPubkey ?? (Array.isArray(found.vaults) && found.vaults[0]?.vaultPubkey) ?? null;
            setIntentVaultPubkey(pub);
          }
        }
      }
    }

    // --- SWAP_TOKENS intent (NEW) ---
    if (type === "SWAP_TOKENS") {
      // parse fields
      const from = (intent.from_token ?? intent.fromToken ?? intent.from ?? null)?.toString().toUpperCase() ?? null;
      const to = (intent.to_token ?? intent.toToken ?? intent.to ?? null)?.toString().toUpperCase() ?? null;
      const amount = typeof intent.amount === "number" ? intent.amount : intent.amount ? Number(intent.amount) : null;

      setSwapFrom(from);
      setSwapTo(to);
      setSwapAmount(amount ?? null);
      setSwapActive(true);
      setSwapError(null);
      setSwapSuccessTx(null);

      // if missing fields, we still show UI so user can edit
    }
  }

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed) return;
    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: "user",
      text: trimmed,
      createdAt: new Date().toISOString(),
    };

    // Add user message locally
    addMessage(userMsg);
    setInput("");

    // Start typing simulation
    setSending(true);
    setTyping(true);

    try {
      // call backend endpoint
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25_000); // 25s timeout

      const payload = { message: trimmed };
      let aiText = "";
      let aiRaw: any = null;

      try {
        const resp = await fetch(`http://localhost:8000/api/v1/chat/${user?.id}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!resp.ok) throw new Error(`Server error: ${resp.status}`);

        const data = await resp.json();
        aiRaw = data;
        aiText = typeof data?.response === "string" ? data.response : typeof data?.reply === "string" ? data.reply : JSON.stringify(data);
      } catch (err) {
        // fallback dummy reply when endpoint missing / errored
        console.warn("Chat API failed, falling back to dummy response:", err);
        await new Promise((r) => setTimeout(r, 700 + Math.random() * 800));
        aiText = `I received: "${trimmed}" — (this is a dummy reply because the endpoint isn't live yet)`;
      }

      await new Promise((r) => setTimeout(r, 450));

      await handleAiResponse(aiRaw, aiText);
    } finally {
      setTyping(false);
      setSending(false);
    }
  }

  // Deposit flow used by the inline intent UI. Mirrors SavePage behavior.
  async function handleDepositFromIntent() {
    setDepositError(null);
    setDepositSuccessTx(null);

    if (!intentToken) {
      setDepositError("No token provided for deposit.");
      return;
    }
    if (!intentAmount || Number.isNaN(intentAmount) || intentAmount <= 0) {
      setDepositError("Invalid deposit amount.");
      return;
    }
    // Resolve vault pubkey
    let vaultPubkey = intentVaultPubkey;
    let vaultPlanId = intentVaultPlanId;
    if (!vaultPubkey) {
      const plans = vaultPlans ?? (await fetchVaultPlans());
      const chosen = plans && plans.length > 0 ? plans[0] : null;
      if (!chosen) {
        setDepositError("No vault recipient available.");
        return;
      }
      vaultPlanId = vaultPlanId ?? chosen.id;
      vaultPubkey = chosen.vaultPubkey ?? (Array.isArray(chosen.vaults) && chosen.vaults[0]?.vaultPubkey) ?? null;
      if (!vaultPubkey) {
        setDepositError("Vault plan has no recipient address.");
        return;
      }
      setIntentVaultPlanId(vaultPlanId);
      setIntentVaultPubkey(vaultPubkey);
    }

    setDepositProcessing(true);
    try {
      const sendResult = await send({
        token: intentToken as any,
        amount: intentAmount,
        recipient: vaultPubkey,
      });

      if (!sendResult.success) {
        const errMsg = sendResult.error ?? "On-chain transfer failed";
        setDepositError(errMsg);
        return;
      }

      const txid = sendResult.txid;
      try {
        const resp = await apiClient.post(
          "/api/deposit",
          {
            token: intentToken,
            amount: intentAmount,
            vaultPlanId: vaultPlanId,
            txHash: txid,
          },
          {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          }
        );

        setDepositSuccessTx(txid ?? null);
        setIntentActive(false);
        addMessage({
          id: `sys_${Date.now()}`,
          role: "ai",
          text: `Deposit completed: ${intentAmount} ${intentToken} — tx ${txid}`,
          createdAt: new Date().toISOString(),
        });
      } catch (depositErr: any) {
        const depositMsg = depositErr?.response?.data ?? depositErr?.message ?? String(depositErr);
        setDepositError(`Deposit endpoint failed: ${depositMsg}. You can retry deposit-only.`);
        setDepositSuccessTx(txid ?? null);
      }
    } catch (err: any) {
      setDepositError(err?.message ?? String(err));
    } finally {
      setDepositProcessing(false);
    }
  }

  // If depositOnly (we already have txid), call deposit endpoint again
  async function handleDepositOnlyRetry(txid: string) {
    if (!txid) return;
    setDepositProcessing(true);
    setDepositError(null);

    try {
      await apiClient.post(
        "/api/deposit",
        {
          token: intentToken,
          amount: intentAmount,
          vaultPlanId: intentVaultPlanId,
          txHash: txid,
        },
        {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        }
      );

      setDepositSuccessTx(txid);
      setIntentActive(false);
      addMessage({
        id: `sys_${Date.now()}`,
        role: "ai",
        text: `Deposit recorded for tx ${txid}.`,
        createdAt: new Date().toISOString(),
      });
    } catch (err: any) {
      const message = err?.response?.data ?? err?.message ?? String(err);
      setDepositError(String(message));
    } finally {
      setDepositProcessing(false);
    }
  }

  // ----- SWAP (simulated) -----
  // Confirm swap (simulated): show processing modal, wait, then success
  async function handleConfirmSwap() {
    setSwapError(null);
    setSwapSuccessTx(null);

    if (!swapFrom || !swapTo) {
      setSwapError("Swap tokens not specified.");
      return;
    }
    if (!swapAmount || Number.isNaN(swapAmount) || swapAmount <= 0) {
      setSwapError("Invalid swap amount.");
      return;
    }

    setSwapProcessing(true);

    try {
      // simulate network/on-chain delay (randomized)
      const delay = 1500 + Math.floor(Math.random() * 700);
      await new Promise((r) => setTimeout(r, delay));

      // create a fake tx id so UI can show success similarly to a real tx
      const fakeTx = `${Date.now().toString(36)}_${Math.floor(Math.random() * 9999)}`;

      // success: show modal + append system message
      setSwapSuccessTx(fakeTx);
      setSwapActive(false);

      addMessage({
        id: `sys_swap_${Date.now()}`,
        role: "ai",
        text: `Swap completed: ${swapAmount} ${swapFrom} → 182 ${swapTo}`,
        createdAt: new Date().toISOString(),
      });

      // Optionally suggest next action (e.g., deposit) — keep minimal here
      addMessage({
        id: `sys_next_${Date.now()}`,
        role: "ai",
        text: `You can now deposit the ${swapTo} into a vault. Ask me to "deposit" or I'll guide you if you'd like.`,
        createdAt: new Date().toISOString(),
      });
    } catch (err: any) {
      setSwapError(err?.message ? err : "Swap failed (simulated).");
    } finally {
      setSwapProcessing(false);
    }
  }

  // Cancel swap UI
  function handleCancelSwap() {
    setSwapActive(false);
    setSwapError(null);
    setSwapFrom(null);
    setSwapTo(null);
    setSwapAmount(null);
    setSwapSuccessTx(null);
  }

  // helper: send on enter (shift+enter for newline)
  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!sending) handleSend();
    }
  }

  return (
    <div className="flex h-full flex-col bg-transparent">
      {/* chat history */}
      <div ref={listRef} className="flex-1 flex-col flex overflow-y-auto p-6 space-y-4">
        {messages.length === 0 && (
          <div className="place-items-center text-center flex justify-center items-center h-full">
            <div className="w-full max-w-md">
              <div className="flex flex-col gap-5 items-center">
                <div className="p-8 w-fit rounded-full" style={{ background: "linear-gradient(90deg, #AD54F0 0%, #DF4AAA 100%)" }}>
                  <RobotIcon height="40" width="40" />
                </div>
                <div className="text-xl">How can i help you today?</div>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1">
          {messages.map((m) => (
            <div key={m.id} className={`flex mb-4 ${m.role === "ai" ? "justify-start" : "justify-end"}`}>
              <div
                className={`max-w-[78%] p-3 rounded-lg whitespace-pre-wrap wrap-break-word ${
                  m.role === "ai" ? "bg-[#1945ad] text-white rounded-bl-none" : "bg-blue-50 text-black rounded-br-none"
                }`}
              >
                <div className="text-sm">{m.text}</div>
                <div
                  className={`text-[10px] mt-1 ${m.role === "ai" ? "text-left text-[#292929]" : "text-right text-[#4e4d4d] "}`}
                >
                  {new Date(m.createdAt).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {typing && (
            <div className="flex justify-start">
              <div className="bg-[#1945ad] text-white rounded-lg p-3 max-w-[60%]">
                <TypingDots />
              </div>
            </div>
          )}

          {/* Inline deposit UI */}
          {intentActive && (
            <div className="mt-4 p-4 rounded-lg bg-[#121212] border border-[#2b2b2b] max-w-[90%]">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-xs text-[#A4A4A4]">AI suggested action</div>
                  <div className="text-white font-semibold">Vault deposit</div>
                </div>
                <div className="text-sm text-[#A4A4A4]">Action: DEPOSIT_VAULT</div>
              </div>

              <div className="mb-3">
                <label className="text-sm text-[#A4A4A4] block mb-1">Token</label>
                <input value={intentToken ?? ""} onChange={(e) => setIntentToken(e.target.value.toUpperCase())} className="w-full rounded p-2 bg-[#0d0d0d] text-white" />
              </div>

              <div className="mb-3">
                <label className="text-sm text-[#A4A4A4] block mb-1">Amount</label>
                <input
                  type="number"
                  value={intentAmount ?? ""}
                  onChange={(e) => setIntentAmount(e.target.value ? Number(e.target.value) : null)}
                  className="w-full rounded p-2 bg-[#0d0d0d] text-white"
                />
              </div>

              <div className="mb-3">
                <label className="text-sm text-[#A4A4A4] block mb-1">Vault Plan ID</label>
                <input value={intentVaultPlanId ?? ""} onChange={(e) => setIntentVaultPlanId(e.target.value)} className="w-full rounded p-2 bg-[#0d0d0d] text-white" />
                <div className="text-xs text-[#6b6b6b] mt-1">If empty, the first active plan will be used (if available).</div>
              </div>

              <div className="mb-3">
                <label className="text-sm text-[#A4A4A4] block mb-1">Vault Recipient (pubkey)</label>
                <input value={intentVaultPubkey ?? ""} onChange={(e) => setIntentVaultPubkey(e.target.value)} className="w-full rounded p-2 bg-[#0d0d0d] text-white" />
                <div className="text-xs text-[#6b6b6b] mt-1">If empty, the plan's default vaultPubkey will be used.</div>
              </div>

              {depositError && <div className="text-red-400 mb-2">{depositError}</div>}
              {depositSuccessTx && (
                <div className="text-green-400 mb-2">
                  Deposit recorded. Tx: <span className="font-mono">{depositSuccessTx}</span>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    if (depositSuccessTx) {
                      await handleDepositOnlyRetry(depositSuccessTx);
                      return;
                    }
                    await handleDepositFromIntent();
                  }}
                  disabled={depositProcessing || sendLoading}
                  className="px-4 py-2 rounded bg-[#27AAE1] text-black font-semibold"
                >
                  {depositProcessing || sendLoading ? "Processing..." : depositSuccessTx ? "Retry deposit-only" : "Confirm deposit"}
                </button>

                <button
                  onClick={() => {
                    setIntentActive(false);
                    setDepositError(null);
                  }}
                  className="px-4 py-2 rounded border border-[#2b2b2b] text-[#A4A4A4]"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Inline swap UI (NEW) */}
          {swapActive && (
            <div className="mt-4 p-4 rounded-lg bg-[#1D1D1D] max-w-[90%]">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-white font-semibold">Swap tokens</div>
                </div>
              </div>

              <div className="flex justify-between items-center gap-4">
                <div className="mb-3 flex gap-2 items-center">
                  <label className="text-sm text-[#A4A4A4] block mb-1">From</label>
                  <input value={swapFrom ?? ""} onChange={(e) => setSwapFrom(e.target.value.toUpperCase())} className="w-full rounded-md p-2 bg-[#0D0D0D] text-white" />
                </div>

                <div className="mb-3  flex gap-2 items-center">
                  <label className="text-sm text-[#A4A4A4] block mb-1">To</label>
                  <input value={swapTo ?? ""} onChange={(e) => setSwapTo(e.target.value.toUpperCase())} className="w-full rounded p-2 bg-[#0d0d0d] text-white" />
                </div>
              </div>

              <div className="mb-3  flex gap-4 items-center">
                <label className="text-sm text-[#A4A4A4] block mb-1">Amount</label>
                <input
                  type="number"
                  value={swapAmount ?? ""}
                  onChange={(e) => setSwapAmount(e.target.value ? Number(e.target.value) : null)}
                  className="w-full rounded p-2 bg-[#0d0d0d] text-white"
                />
              </div>

              {swapError && <div className="text-red-400 mb-2">{swapError}</div>}
              {swapSuccessTx && <div className="text-green-400 mb-2">Swap recorded. Tx: <span className="font-mono">{swapSuccessTx}</span></div>}

              <div className="flex gap-2 mt-5">
                <Button
                  text={swapProcessing ? "Processing..." : swapSuccessTx ? "Done" : "Confirm swap"}
                  color="blue"
                  onClick={handleConfirmSwap}
                  otherstyles="flex-1"
                />
                <Button
                  text="Cancel"
                  color="dark"
                  onClick={handleCancelSwap}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* small processing overlay for swap (simple modal) */}
      {swapProcessing && (
        <Modal isOpen={swapProcessing} onClose={()=>{}}>
          <div className="flex w-full items-center justify-center flex-col gap-3">
            <div className="mx-auto w-12 h-12 border-8 border-t-transparent border-b-transparent border-l-transparent rounded-full animate-spin border-[#27AAE1] mb-4" />
            <div className="text-white font-semibold mb-2">Processing swap</div>
            <div className="text-sm text-[#A4A4A4]">Simulating swap of {swapAmount ?? "—"} {swapFrom ?? ""} → 182 {swapTo ?? ""}…</div>
          </div>
        </Modal>
      )}

      {/* swap success modal (simulated) */}
      {swapSuccessTx && !swapProcessing && (
        <Modal isOpen={ (!!swapSuccessTx && !swapProcessing)} onClose={()=>{handleCancelSwap()}}>
          <div className="flex w-full items-center justify-center flex-col gap-2">
            <div className="w-16 h-16 bg-[#005CE6] rounded-full flex items-center justify-center">
            <svg className="w-10 h-10 text-black" fill="currentColor" viewBox="0 0 20 20">
              <path d="M16.707 5.293a1 1 0 00-1.414-1.414L8 11.172 4.707 7.879A1 1 0 003.293 9.293l4 4a1 1 0 001.414 0l8-8z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Swap Successful</h3>
          <p className="text-sm text-[#A4A4A4] mb-4">
            Swapped {swapAmount} {swapFrom} to 182 {swapTo}
          </p>
          <div className="font-mono text-xs mb-4 text-[#9ee6c9] break-words underline">View txn</div>
          <div className="flex  w-full justify-center">
            <Button
              text="Close"
              color="blue"
              onClick={handleCancelSwap}
              otherstyles="flex-1"
            />
          </div>
          </div>
        </Modal>
      )}

      {/* input area */}
      <div className="bg-[#0D0D0D] w-full p-4 max-lg:max-w-[95%] max-w-3xl mb-5 mx-auto rounded-xl">
        <div className="max-w-3xl mx-auto flex flex-col gap-3">
          <div className="w-full flex gap-3 pt-2">
            <button
              onClick={() => {
                setInput(" Analyze my spending");
              }}
              className="px-3 py-3 rounded-md bg-[#161616] text-white text-sm max-sm:text-[10px]"
            >
              Analyze my spending
            </button>
            <button
              onClick={() => {
                setInput("Savings tip");
              }}
              className="px-3 py-3 rounded-md  bg-[#161616] text-sm text-white max-sm:text-[10px]"
            >
              Savings tip
            </button>
            <button
              onClick={() => {
                setInput("Investment advice");
              }}
              className="px-3 py-3 rounded-md  bg-[#161616] text-sm text-white max-sm:text-[10px]"
            >
              Investment advice
            </button>
          </div>
          <div className="w-full h-0.5 bg-[#373737] my-2"></div>
          <div className="w-full relative flex items-center">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder="Type your message..."
              className="flex-1 w-full resize-none bg-[#121212] rounded-full text-white placeholder:text-[#959595] text-sm placeholder:text-sm px-4 py-3 focus:outline-none pr-12"
              disabled={sending}
            />

            <button
              onClick={handleSend}
              disabled={sending || input.trim().length === 0}
              className="absolute right-4 top-1/2 bg-[#B0B0B0] text-white -translate-y-1/2 flex items-center justify-center w-6 h-6 rounded-full disabled:opacity-50 pl-1"
            >
              <svg width="15" height="15" viewBox="0 0 19 21" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M18.7455 10.4855C18.7462 10.7528 18.6754 11.0153 18.5406 11.2461C18.4058 11.4768 18.2118 11.6674 17.9786 11.798L2.2361 20.7989C2.01019 20.927 1.75514 20.9948 1.49547 20.9958C1.25621 20.9945 1.02073 20.936 0.808688 20.8252C0.596644 20.7144 0.414191 20.5544 0.276558 20.3587C0.138925 20.163 0.0501064 19.9372 0.0175173 19.7001C-0.0150719 19.4631 0.00951371 19.2217 0.0892216 18.9961L2.62047 11.5008C2.64521 11.4275 2.692 11.3637 2.75443 11.3181C2.81687 11.2724 2.89189 11.2472 2.96922 11.2458H9.74547C9.84829 11.246 9.95005 11.2251 10.0444 11.1844C10.1388 11.1436 10.2238 11.0839 10.2942 11.0089C10.3645 10.9339 10.4187 10.8452 10.4533 10.7484C10.4879 10.6516 10.5023 10.5487 10.4955 10.4461C10.4785 10.2533 10.3892 10.074 10.2456 9.9441C10.102 9.81424 9.91469 9.74342 9.7211 9.74582H2.9711C2.89264 9.74583 2.81616 9.72122 2.75242 9.67548C2.68868 9.62973 2.64089 9.56515 2.61578 9.49082L0.0845342 1.99644C-0.0162148 1.70919 -0.0271797 1.39808 0.0530962 1.10444C0.133372 0.810803 0.301089 0.54854 0.533966 0.352492C0.766844 0.156443 1.05386 0.035889 1.35688 0.00684439C1.65991 -0.0222002 1.96459 0.0416394 2.23047 0.189882L17.9805 9.17957C18.2123 9.30989 18.4053 9.4995 18.5398 9.72898C18.6742 9.95846 18.7452 10.2196 18.7455 10.4855Z"
                  fill="black"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1">
      <span className="w-2 h-2 rounded-full bg-[#9aa4b2] animate-bounce" style={{ animationDelay: "0s" }} />
      <span className="w-2 h-2 rounded-full bg-[#9aa4b2] animate-bounce" style={{ animationDelay: "0.15s" }} />
      <span className="w-2 h-2 rounded-full bg-[#9aa4b2] animate-bounce" style={{ animationDelay: "0.3s" }} />
    </div>
  );
}

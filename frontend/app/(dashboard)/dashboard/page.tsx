// src/app/dashboard/page.tsx
"use client";
import { useAuth } from "@/context/AuthContext";
import { useWalletContext } from "@/context/WalletContext";
import {
  SendIcon,
  ReceiveIcon,
  SaveIcon,
  SwapIcon,
  RobotIcon,
  BitcoinIcon,
} from "@/components/icons/svgs";
import { useState, useEffect, useRef, useCallback } from "react";
import { useWalletBalancesRealtime } from "@/hooks/useWalletBalancesRealtime";
import { useWalletAuth } from "@/hooks/useWalletAuth";
import { fmt } from "@/lib/helpers";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { usePythPrices } from "@/hooks/usePythPrices";
import Image from "next/image";

const TransactionsList = dynamic(
  () => import("@/components/dashboard/TransactionsList"),
  { ssr: false }
);
const ReceivePanel = dynamic(() => import("@/components/dashboard/RecievePanel"), { ssr: false });
const SendPanel = dynamic(() => import("@/components/dashboard/SendPanel"), { ssr: false });
const ChatPanel = dynamic(() => import("@/components/dashboard/ChatPanel"), { ssr: false });
const VaultBalance = dynamic(() => import("@/components/dashboard/vaultBalance"), { ssr: false });


export default function DashboardPage() {
  const { user } = useAuth();
  const { pubKey } = useWalletContext();
  const router = useRouter();
  const { solBalance, tokens, loading: balancesLoading, prices, bySymbol, totalUsd } = useWalletBalancesRealtime("https://api.devnet.solana.com");
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
 const isUpdatingUrlRef = useRef(false);

  useEffect(() => {
  if (typeof window === "undefined") return;

  const readSendParam = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get("send") === "true";
  };

  // initial read on mount
  setSendOpen(readSendParam());

  // handler to run when location changes
  const onLocationChange = () => {
    // if we just updated the URL ourselves, ignore this event once
    if (isUpdatingUrlRef.current) {
      // clear the flag on next tick so future external changes still respond
      requestAnimationFrame(() => { isUpdatingUrlRef.current = false; });
      return;
    }
    const hasParam = readSendParam();
    setSendOpen(hasParam);
  };

  // monkey-patch history methods to emit a custom event 'locationchange'
  const _pushState = history.pushState;
  const _replaceState = history.replaceState;

  history.pushState = function (...args: any[]) {
    const result = _pushState.apply(this, args as any);
    const ev = new Event("locationchange");
    window.dispatchEvent(ev);
    return result;
  };

  history.replaceState = function (...args: any[]) {
    const result = _replaceState.apply(this, args as any);
    const ev = new Event("locationchange");
    window.dispatchEvent(ev);
    return result;
  };

  // listen to popstate (back/forward) and our custom locationchange
  window.addEventListener("popstate", onLocationChange);
  window.addEventListener("locationchange", onLocationChange);

  return () => {
    // restore
    history.pushState = _pushState;
    history.replaceState = _replaceState;
    window.removeEventListener("popstate", onLocationChange);
    window.removeEventListener("locationchange", onLocationChange);
  };
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);


useEffect(() => {
  // sync UI -> URL. Use a ref to avoid reacting to our own update
  if (typeof window === "undefined") return;

  const params = new URLSearchParams(window.location.search);
  const hasParam = params.get("send") === "true";

  if (sendOpen && !hasParam) {
    // add the param without adding history entry (use replace)
    isUpdatingUrlRef.current = true;
    router.replace("/dashboard?send=true");
    return;
  }

  if (!sendOpen && hasParam) {
    isUpdatingUrlRef.current = true;
    router.replace("/dashboard");
  }
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [sendOpen]);
  
  // helper to get price number for a token or SOL (uses prices returned by the balances hook)
  const getPriceForToken = (symbolOrMint?: string) => {
    if (!symbolOrMint) return null;
    // prices object uses symbol keys like "SOL", "USDC", "USDT"
    const entry = (prices as any)?.[symbolOrMint];
    if (entry && typeof entry.price === "number") return entry.price;
    return null;
  };

  // per-token USD calculation for each token account
  const tokenRows = tokens.map((t) => {
    const ui = typeof t.uiAmount === "number" ? t.uiAmount : Number(t.amountRaw) / 10 ** t.decimals;
    const symbol = t.tokenSymbol ?? t.mint;
    const price = getPriceForToken(symbol); // might be null
    const usd = price != null ? ui * price : null;
    return { ...t, uiAmountDisplay: ui, price, usd, symbol };
  });

  // SOL USD value
  const solPrice = getPriceForToken("SOL");
  const solUsdValue = solBalance != null && solPrice != null ? solBalance * solPrice : null;

  return (
    <main className="flex-1 p-4 md:p-6 overflow-y-auto">
      {/* Total Balance Card */}
      <div className="bg-linear-to-r from-[#005CE6] to-[#003A99] rounded-xl p-4 md:p-6 mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-medium text-blue-100">Total Balance</h2>

          {/* Refresh button */}
          {/* <div className="flex items-center gap-2">
            <button
              onClick={refreshTransactions}
              className="text-blue-200 hover:text-white transition-colors"
              title="Refresh transactions"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M4 4v5h.582A5.5 5.5 0 1115.5 10H14a4 4 0 10-4 4v1a5 5 0 10-6-9z" />
              </svg>
            </button>
          </div> */}
        </div>
        <div className="text-4xl font-bold text-white mb-4">${typeof totalUsd === "number" ? totalUsd.toFixed(2) : "—"}</div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
          <button onClick={() => setSendOpen(true)} className="bg-[#658BEC] cursor-pointer hover:bg-white/30 text-white py-2 md:py-3 px-2 md:px-4 rounded-[20.5px] text-[11px] md:text-[13px] font-inter font-medium flex items-center justify-center space-x-1 md:space-x-2 transition-all duration-200">
            <svg width="19" height="21" viewBox="0 0 19 21" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18.7455 10.4855C18.7462 10.7528 18.6754 11.0153 18.5406 11.2461C18.4058 11.4768 18.2118 11.6674 17.9786 11.798L2.2361 20.7989C2.01019 20.927 1.75514 20.9948 1.49547 20.9958C1.25621 20.9945 1.02073 20.936 0.808688 20.8252C0.596644 20.7144 0.414191 20.5544 0.276558 20.3587C0.138925 20.163 0.0501064 19.9372 0.0175173 19.7001C-0.0150719 19.4631 0.00951371 19.2217 0.0892216 18.9961L2.62047 11.5008C2.64521 11.4275 2.692 11.3637 2.75443 11.3181C2.81687 11.2724 2.89189 11.2472 2.96922 11.2458H9.74547C9.84829 11.246 9.95005 11.2251 10.0444 11.1844C10.1388 11.1436 10.2238 11.0839 10.2942 11.0089C10.3645 10.9339 10.4187 10.8452 10.4533 10.7484C10.4879 10.6516 10.5023 10.5487 10.4955 10.4461C10.4785 10.2533 10.3892 10.074 10.2456 9.9441C10.102 9.81424 9.91469 9.74342 9.7211 9.74582H2.9711C2.89264 9.74583 2.81616 9.72122 2.75242 9.67548C2.68868 9.62973 2.64089 9.56515 2.61578 9.49082L0.0845342 1.99644C-0.0162148 1.70919 -0.0271797 1.39808 0.0530962 1.10444C0.133372 0.810803 0.301089 0.54854 0.533966 0.352492C0.766844 0.156443 1.05386 0.035889 1.35688 0.00684439C1.65991 -0.0222002 1.96459 0.0416394 2.23047 0.189882L17.9805 9.17957C18.2123 9.30989 18.4053 9.4995 18.5398 9.72898C18.6742 9.95846 18.7452 10.2196 18.7455 10.4855Z" fill="white" />
            </svg>
            <span className="">Send</span>
          </button>
          <button onClick={() => setReceiveOpen(true)} className="bg-[#658BEC] cursor-pointer hover:bg-white/30 text-white py-2 md:py-3 px-2 md:px-4 rounded-[20.5px] text-[11px] md:text-[13px] font-inter font-medium flex items-center justify-center space-x-1 md:space-x-2 transition-all duration-200">
            <svg width="21" height="19" viewBox="0 0 21 19" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M5.46937 6.53063C5.32864 6.38989 5.24958 6.19902 5.24958 6C5.24958 5.80098 5.32864 5.61011 5.46938 5.46938C5.61011 5.32864 5.80098 5.24958 6 5.24958C6.19902 5.24958 6.38989 5.32864 6.53063 5.46937L9.75 8.68969V0.75C9.75 0.551088 9.82902 0.360322 9.96967 0.21967C10.1103 0.0790176 10.3011 0 10.5 0C10.6989 0 10.8897 0.0790176 11.0303 0.21967C11.171 0.360322 11.25 0.551088 11.25 0.75V8.68969L14.4694 5.46937C14.6101 5.32864 14.801 5.24958 15 5.24958C15.199 5.24958 15.3899 5.32864 15.5306 5.46937C15.6714 5.61011 15.7504 5.80098 15.7504 6C15.7504 6.19902 15.6714 6.38989 15.5306 6.53063L11.0306 11.0306C10.961 11.1004 10.8783 11.1557 10.7872 11.1934C10.6962 11.2312 10.5986 11.2506 10.5 11.2506C10.4014 11.2506 10.3038 11.2312 10.2128 11.1934C10.1217 11.1557 10.039 11.1004 9.96937 11.0306L5.46937 6.53063ZM21 11.25V17.25C21 17.6478 20.842 18.0294 20.5607 18.3107C20.2794 18.592 19.8978 18.75 19.5 18.75H1.5C1.10218 18.75 0.720644 18.592 0.43934 18.3107C0.158035 18.0294 0 17.6478 0 17.25V11.25C0 10.8522 0.158035 10.4706 0.43934 10.1893C0.720644 9.90804 1.10218 9.75 1.5 9.75H6.4125C6.46176 9.74996 6.51055 9.75963 6.55607 9.77845C6.60159 9.79727 6.64296 9.82487 6.67781 9.85969L8.90625 12.0938C9.11528 12.3035 9.36367 12.4699 9.63716 12.5835C9.91065 12.6971 10.2039 12.7555 10.5 12.7555C10.7961 12.7555 11.0893 12.6971 11.3628 12.5835C11.6363 12.4699 11.8847 12.3035 12.0938 12.0938L14.325 9.8625C14.3942 9.79184 14.4886 9.75141 14.5875 9.75H19.5C19.8978 9.75 20.2794 9.90804 20.5607 10.1893C20.842 10.4706 21 10.8522 21 11.25ZM17.25 14.25C17.25 14.0275 17.184 13.81 17.0604 13.625C16.9368 13.44 16.7611 13.2958 16.5555 13.2106C16.35 13.1255 16.1238 13.1032 15.9055 13.1466C15.6873 13.19 15.4868 13.2972 15.3295 13.4545C15.1722 13.6118 15.065 13.8123 15.0216 14.0305C14.9782 14.2488 15.0005 14.475 15.0856 14.6805C15.1708 14.8861 15.315 15.0618 15.5 15.1854C15.685 15.309 15.9025 15.375 16.125 15.375C16.4234 15.375 16.7095 15.2565 16.9205 15.0455C17.1315 14.8345 17.25 14.5484 17.25 14.25Z" fill="white" />
            </svg>
            <span className="">Receive</span>
          </button>
          <button onClick={() => router.push('/vaults')} className="bg-[#658BEC] cursor-pointer hover:bg-white/30 text-white py-2 md:py-3 px-2 md:px-4 rounded-[20.5px] text-[11px] md:text-[13px] font-inter font-medium flex items-center justify-center space-x-1 md:space-x-2 transition-all duration-200">
            <svg width="24" height="18" viewBox="0 0 24 18" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21.1875 5.25C21.15 5.15625 21.1106 5.0625 21.0703 4.96875C20.4654 3.57378 19.4865 2.37328 18.2419 1.5H20.25C20.4489 1.5 20.6397 1.42098 20.7803 1.28033C20.921 1.13968 21 0.948912 21 0.75C21 0.551088 20.921 0.360322 20.7803 0.21967C20.6397 0.0790174 20.4489 0 20.25 0H10.5C8.42634 0.00263304 6.42951 0.785021 4.90601 2.1918C3.38252 3.59859 2.4438 5.52687 2.27625 7.59375C1.6284 7.75479 1.05277 8.12732 0.640489 8.65236C0.228203 9.17739 0.00281392 9.82494 0 10.4925C0 10.6914 0.0790176 10.8822 0.21967 11.0228C0.360322 11.1635 0.551088 11.2425 0.75 11.2425C0.948912 11.2425 1.13968 11.1635 1.28033 11.0228C1.42098 10.8822 1.5 10.6914 1.5 10.4925C1.50017 10.219 1.57512 9.95077 1.71673 9.71679C1.85834 9.48281 2.06122 9.292 2.30344 9.165C2.49012 10.8477 3.19176 12.4317 4.3125 13.7006L5.49 16.9969C5.5941 17.2884 5.78586 17.5406 6.03898 17.7189C6.29209 17.8972 6.59416 17.9927 6.90375 17.9925H8.09625C8.40568 17.9925 8.70754 17.8969 8.96047 17.7186C9.2134 17.5404 9.40502 17.2883 9.50906 16.9969L9.68906 16.4925H15.0609L15.2409 16.9969C15.345 17.2883 15.5366 17.5404 15.7895 17.7186C16.0425 17.8969 16.3443 17.9925 16.6537 17.9925H17.8463C18.1557 17.9925 18.4575 17.8969 18.7105 17.7186C18.9634 17.5404 19.155 17.2883 19.2591 16.9969L20.7787 12.7425H21C21.5967 12.7425 22.169 12.5054 22.591 12.0835C23.0129 11.6615 23.25 11.0892 23.25 10.4925V7.4925C23.2501 6.92816 23.0381 6.3844 22.6561 5.96904C22.274 5.55367 21.7499 5.29703 21.1875 5.25ZM14.25 3.7425H10.5C10.3011 3.7425 10.1103 3.66348 9.96967 3.52283C9.82902 3.38218 9.75 3.19141 9.75 2.9925C9.75 2.79359 9.82902 2.60282 9.96967 2.46217C10.1103 2.32152 10.3011 2.2425 10.5 2.2425H14.25C14.4489 2.2425 14.6397 2.32152 14.7803 2.46217C14.921 2.60282 15 2.79359 15 2.9925C15 3.19141 14.921 3.38218 14.7803 3.52283C14.6397 3.66348 14.4489 3.7425 14.25 3.7425ZM16.875 8.9925C16.6525 8.9925 16.435 8.92652 16.25 8.8029C16.065 8.67929 15.9208 8.50359 15.8356 8.29802C15.7505 8.09245 15.7282 7.86625 15.7716 7.64802C15.815 7.42979 15.9222 7.22934 16.0795 7.072C16.2368 6.91467 16.4373 6.80752 16.6555 6.76412C16.8738 6.72071 17.1 6.74299 17.3055 6.82814C17.5111 6.91328 17.6868 7.05748 17.8104 7.24248C17.934 7.42749 18 7.645 18 7.8675C18 8.16587 17.8815 8.45202 17.6705 8.663C17.4595 8.87397 17.1734 8.9925 16.875 8.9925Z" fill="white"/></svg>
            <span className="">Vaults</span>
          </button>
          <div className="relative inline-block group w-full">
            <button disabled aria-disabled="true" tabIndex={-1} className="bg-[#658BEC] w-full text-white py-2 md:py-3 px-2 md:px-4 rounded-[20.5px] text-[11px] md:text-[13px] font-inter font-medium flex items-center justify-center space-x-1 md:space-x-2 transition-all duration-200 opacity-60 cursor-not-allowed">
              <svg width="23" height="18" viewBox="0 0 23 18" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22.5 17.2505C22.5 17.4494 22.421 17.6401 22.2803 17.7808C22.1397 17.9215 21.9489 18.0005 21.75 18.0005H0.75C0.551088 18.0005 0.360322 17.9215 0.21967 17.7808C0.0790176 17.6401 0 17.4494 0 17.2505C0 17.0516 0.0790176 16.8608 0.21967 16.7201C0.360322 16.5795 0.551088 16.5005 0.75 16.5005H21.75C21.9489 16.5005 22.1397 16.5795 22.2803 16.7201C22.421 16.8608 22.5 17.0516 22.5 17.2505ZM0.778125 6.95485C0.733517 6.79756 0.741523 6.63001 0.800925 6.4777C0.860328 6.32538 0.967872 6.19665 1.10719 6.1111L10.8572 0.111096C10.9753 0.0384567 11.1113 0 11.25 0C11.3887 0 11.5247 0.0384567 11.6428 0.111096L21.3928 6.1111C21.5322 6.19655 21.6398 6.32519 21.6993 6.47744C21.7588 6.62969 21.767 6.79721 21.7225 6.95452C21.678 7.11182 21.5834 7.25029 21.4529 7.34884C21.3225 7.44739 21.1635 7.50064 21 7.50047H18.75V13.5005H20.25C20.4489 13.5005 20.6397 13.5795 20.7803 13.7201C20.921 13.8608 21 14.0516 21 14.2505C21 14.4494 20.921 14.6401 20.7803 14.7808C20.6397 14.9215 20.4489 15.0005 20.25 15.0005H2.25C2.05109 15.0005 1.86032 14.9215 1.71967 14.7808C1.57902 14.6401 1.5 14.4494 1.5 14.2505C1.5 14.0516 1.57902 13.8608 1.71967 13.7201C1.86032 13.5795 2.05109 13.5005 2.25 13.5005H3.75V7.50047H1.5C1.33668 7.50053 1.1778 7.44727 1.04751 7.34879C0.917215 7.25031 0.82263 7.11199 0.778125 6.95485ZM12.75 12.7505C12.75 12.9494 12.829 13.1401 12.9697 13.2808C13.1103 13.4215 13.3011 13.5005 13.5 13.5005C13.6989 13.5005 13.8897 13.4215 14.0303 13.2808C14.171 13.1401 14.25 12.9494 14.25 12.7505V8.25047C14.25 8.05156 14.171 7.86079 14.0303 7.72014C13.8897 7.57949 13.6989 7.50047 13.5 7.50047C13.3011 7.50047 13.1103 7.57949 12.9697 7.72014C12.829 7.86079 12.75 8.05156 12.75 8.25047V12.7505ZM8.25 12.7505C8.25 12.9494 8.32902 13.1401 8.46967 13.2808C8.61032 13.4215 8.80109 13.5005 9 13.5005C9.19891 13.5005 9.38968 13.4215 9.53033 13.2808C9.67098 13.1401 9.75 12.9494 9.75 12.7505V8.25047C9.75 8.05156 9.67098 7.86079 9.53033 7.72014C9.38968 7.57949 9.19891 7.50047 9 7.50047C8.80109 7.50047 8.61032 7.57949 8.46967 7.72014C8.32902 7.86079 8.25 8.05156 8.25 8.25047V12.7505Z" fill="white"/></svg>
            <span className="">Withdraw</span>
            </button>
          </div>
        </div>
      </div>

      {/* AI Assistant Banner */}
      <div onClick={()=>setChatOpen(true)} className="cursor-pointer bg-linear-to-r from-[#AD54F0] to-[#DF4AAA] rounded-xl p-4 md:pl-4 md:pt-4.5 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <RobotIcon/>
          <div>
            <h3 className="text-base font-inter leading-normal font-semibold text-white">
              AI Assistant
            </h3> 
            <p className="text-white text-[13px] font-normal leading-normal">
              Get personalized saving recommendation
            </p>
          </div>
        </div>
        <svg width="79" height="70" viewBox="0 0 79 70" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M72.1875 16.4062H45.9375V3.28125C45.9375 2.41101 45.5918 1.57641 44.9764 0.961056C44.3611 0.345702 43.5265 0 42.6562 0C41.786 0 40.9514 0.345702 40.3361 0.961056C39.7207 1.57641 39.375 2.41101 39.375 3.28125V16.4062H13.125C9.64403 16.4062 6.30564 17.7891 3.84422 20.2505C1.38281 22.7119 0 26.0503 0 29.5312V75.4688C0 78.9497 1.38281 82.2881 3.84422 84.7495C6.30564 87.2109 9.64403 88.5938 13.125 88.5938H72.1875C75.6685 88.5938 79.0069 87.2109 81.4683 84.7495C83.9297 82.2881 85.3125 78.9497 85.3125 75.4688V29.5312C85.3125 26.0503 83.9297 22.7119 81.4683 20.2505C79.0069 17.7891 75.6685 16.4062 72.1875 16.4062ZM60.7031 36.0938C61.6766 36.0938 62.6282 36.3824 63.4376 36.9232C64.247 37.4641 64.8778 38.2327 65.2503 39.1321C65.6229 40.0315 65.7203 41.0211 65.5304 41.9758C65.3405 42.9306 64.8717 43.8076 64.1834 44.4959C63.4951 45.1843 62.6181 45.653 61.6633 45.8429C60.7086 46.0328 59.719 45.9354 58.8196 45.5628C57.9203 45.1903 57.1516 44.5595 56.6107 43.7501C56.0699 42.9407 55.7812 41.9891 55.7812 41.0156C55.7812 39.7103 56.2998 38.4584 57.2228 37.5353C58.1459 36.6123 59.3978 36.0938 60.7031 36.0938ZM29.5312 72.1875H22.9688C21.2283 72.1875 19.5591 71.4961 18.3284 70.2654C17.0977 69.0347 16.4062 67.3655 16.4062 65.625C16.4062 63.8845 17.0977 62.2153 18.3284 60.9846C19.5591 59.7539 21.2283 59.0625 22.9688 59.0625H29.5312V72.1875ZM24.6094 45.9375C23.6359 45.9375 22.6843 45.6488 21.8749 45.108C21.0655 44.5672 20.4347 43.7985 20.0622 42.8991C19.6896 41.9998 19.5922 41.0102 19.7821 40.0554C19.972 39.1007 20.4407 38.2237 21.1291 37.5353C21.8174 36.847 22.6944 36.3782 23.6492 36.1883C24.6039 35.9984 25.5935 36.0959 26.4929 36.4684C27.3923 36.8409 28.1609 37.4718 28.7018 38.2812C29.2426 39.0906 29.5312 40.0422 29.5312 41.0156C29.5312 42.321 29.0127 43.5729 28.0897 44.4959C27.1666 45.4189 25.9147 45.9375 24.6094 45.9375ZM49.2188 72.1875H36.0938V59.0625H49.2188V72.1875ZM62.3438 72.1875H55.7812V59.0625H62.3438C64.0842 59.0625 65.7534 59.7539 66.9841 60.9846C68.2148 62.2153 68.9062 63.8845 68.9062 65.625C68.9062 67.3655 68.2148 69.0347 66.9841 70.2654C65.7534 71.4961 64.0842 72.1875 62.3438 72.1875Z" fill="#0D0D0D"/></svg>
      </div>


      <div className="lg:flex justify-between gap-10 items-start">
        {/* Your Assets */}
        <div className="mb-10 w-full">
          <h3 className="text-xl font-semibold mb-4">Your Assets</h3>
          <div className="bg-[#292929] rounded-2xl p-4 flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Image src="/images/sol.jpeg" alt="solana logo" width={40} height={40} className="rounded-full"/>
              <div>
                <div className="font-semibold text-lg">Solana</div>
                <div className="text-xs text-gray-300"> {solPrice != null ? `$${solPrice.toFixed(2)}` : ""}</div>
              </div>
            </div>

            <div className="text-right">
              <div className="font-semibold text-lg">
                {solBalance === null ? "—" : `${fmt(solBalance) } SOL`}
              </div>
              <div className="text-sm text-gray-300">
                ${solUsdValue != null ? solUsdValue.toFixed(2) : "—"}
              </div>
            </div>
          </div>
          {/* Token list */}
          <div>
            {balancesLoading ? <div className="bg-[#292929] rounded-2xl p-4">Loading tokens…</div> : tokens.length === 0 ? (
              <div className="bg-[#292929] rounded-2xl p-4">No tokens</div>
            ) : (
              <div className="space-y-3">
                {tokenRows.map((r) => {
                  const shortenMint = `${r.mint.slice(0, 4)}...${r.mint.slice(-4)}`;
                  const fallbackLetters = r.mint.slice(0, 2).toUpperCase();
                  return (
                    <div key={r.accountAddress} className="bg-[#292929] rounded-2xl p-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {r.tokenIcon ? <img src={r.tokenIcon} alt={r.tokenSymbol ?? 'token'} className="w-10 h-10 rounded-full" /> : <div className="w-10 h-10 rounded-full bg-black border  flex items-center justify-center text-[#D8E1F2] font-semibold">{fallbackLetters}</div>}
                        <div>
                          <div className="font-semibold ">{r.tokenName ?? r.mint}</div>
                          <div className="text-gray-300 text-xs">  {r.price != null ? `$${r.price.toFixed(2)}` : ""}</div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-semibold text-lg">{r.uiAmountDisplay?.toFixed(2) ?? (Number(r.amountRaw) / 10 ** r.decimals).toFixed(2)} {r.tokenSymbol ?? shortenMint}</div>
                        <div className="text-sm text-gray-300">
                          ${(r.usd ?? 0).toFixed(2)} 
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="mb-6 w-full">
          <TransactionsList
            pubKey={pubKey}
            tokens={tokens}
            showFilter={true}
            initialFilter="all" // or "deposits" | "withdrawals"
            lsKeyPrefix="senti:txs:"
            onTransactionsChange={(txs) => {}}
          />
        </div>

      </div>


      <ReceivePanel open={receiveOpen} onClose={() => setReceiveOpen(false)} />
      <SendPanel open={sendOpen} onClose={() => setSendOpen(false)} />
      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
    </main>
  );
}

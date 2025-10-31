// src/components/examples/DashboardWithModal.tsx
"use client";
import React from "react";
import DepositErrorModal from "../modals/DepositErrorModal";
import { useDepositErrorModal } from "@/hooks/useModal";

export default function DashboardWithModal() {
  const depositErrorModal = useDepositErrorModal();

  return (
    <div className="min-h-screen bg-[#171717]">
      {/* Simulated Dashboard Background */}
      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 bg-[#292929] h-screen p-6">
          <div className="text-white font-bold text-xl mb-8">Senti</div>
          <nav className="space-y-2">
            <div className="bg-[#005CE6] text-white px-4 py-2 rounded-lg">
              Home
            </div>
            <div className="text-[#A4A4A4] px-4 py-2">View</div>
            <div className="text-[#A4A4A4] px-4 py-2">Add</div>
            <div className="text-[#A4A4A4] px-4 py-2">Scan</div>
            <div className="text-[#A4A4A4] px-4 py-2">Receipts</div>
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6">
          {/* Total Balance Card */}
          <div className="bg-gradient-to-r from-[#005CE6] to-[#003A99] rounded-2xl p-6 mb-6">
            <h2 className="text-lg font-medium text-blue-100 mb-2">
              Total Balance
            </h2>
            <div className="text-4xl font-bold text-white mb-4">$1,263.16</div>
            <div className="grid grid-cols-3 gap-3">
              <button className="bg-white/20 text-white py-2 px-4 rounded-lg text-sm">
                Deposit
              </button>
              <button className="bg-white/20 text-white py-2 px-4 rounded-lg text-sm">
                Withdraw
              </button>
              <button className="bg-white/20 text-white py-2 px-4 rounded-lg text-sm">
                Transfer
              </button>
            </div>
          </div>

          {/* Purple Banner */}
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl p-6 mb-6">
            <h3 className="text-lg font-semibold text-white">Transactions</h3>
            <p className="text-purple-100 text-sm">Recent activity</p>
          </div>

          {/* Receipts Section */}
          <div className="bg-[#292929] rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">
              Your Receipts
            </h3>
            <div className="space-y-3">
              <div className="flex items-center space-x-3 text-[#A4A4A4]">
                <div className="w-8 h-8 bg-[#333333] rounded flex items-center justify-center">
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm3 6a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1zm1-3a1 1 0 100 2h4a1 1 0 100-2H8z" />
                  </svg>
                </div>
                <span className="text-sm">Receipt 1</span>
              </div>
              <div className="flex items-center space-x-3 text-[#A4A4A4]">
                <div className="w-8 h-8 bg-[#333333] rounded flex items-center justify-center">
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm3 6a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1zm1-3a1 1 0 100 2h4a1 1 0 100-2H8z" />
                  </svg>
                </div>
                <span className="text-sm">Receipt 2</span>
              </div>
            </div>
          </div>

          {/* Trigger Button */}
          <div className="mt-6">
            <button
              onClick={() => depositErrorModal.showError("timeout")}
              className="bg-[#005CE6] text-white py-3 px-6 rounded-2xl font-semibold hover:bg-[#0047B3] transition-colors"
            >
              Trigger Deposit Error Modal
            </button>
          </div>
        </div>
      </div>

      {/* Modal Overlay */}
      <DepositErrorModal
        isOpen={depositErrorModal.isOpen}
        onClose={depositErrorModal.close}
        onRetry={depositErrorModal.retry}
        errorType={depositErrorModal.errorType}
      />
    </div>
  );
}

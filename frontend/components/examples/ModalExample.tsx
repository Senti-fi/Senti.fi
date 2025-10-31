// src/components/examples/ModalExample.tsx
"use client";
import React from "react";
import DepositErrorModal from "../modals/DepositErrorModal";
import { useDepositErrorModal } from "@/hooks/useModal";

export default function ModalExample() {
  const depositErrorModal = useDepositErrorModal();

  const handleDepositError = (
    errorType: "timeout" | "processing" | "rejection" | "network"
  ) => {
    depositErrorModal.showError(errorType);
  };

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-xl font-bold text-white mb-4">Modal Examples</h2>

      {/* Trigger Buttons */}
      <div className="space-y-2">
        <button
          onClick={() => handleDepositError("timeout")}
          className="w-full bg-[#005CE6] text-white py-2 px-4 rounded-lg hover:bg-[#0047B3] transition-colors"
        >
          Show Timeout Error
        </button>

        <button
          onClick={() => handleDepositError("processing")}
          className="w-full bg-[#005CE6] text-white py-2 px-4 rounded-lg hover:bg-[#0047B3] transition-colors"
        >
          Show Processing Error
        </button>

        <button
          onClick={() => handleDepositError("rejection")}
          className="w-full bg-[#005CE6] text-white py-2 px-4 rounded-lg hover:bg-[#0047B3] transition-colors"
        >
          Show Rejection Error
        </button>

        <button
          onClick={() => handleDepositError("network")}
          className="w-full bg-[#005CE6] text-white py-2 px-4 rounded-lg hover:bg-[#0047B3] transition-colors"
        >
          Show Network Error
        </button>
      </div>

      {/* Modal */}
      <DepositErrorModal
        isOpen={depositErrorModal.isOpen}
        onClose={depositErrorModal.close}
        onRetry={depositErrorModal.retry}
        errorType={depositErrorModal.errorType}
      />
    </div>
  );
}

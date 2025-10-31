// src/components/ui/ErrorModal.tsx
"use client";
import React from "react";
import Modal from "./Modal";

interface ErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRetry: () => void;
  title: string;
  message: string;
  hint?: string;
}

export default function ErrorModal({
  isOpen,
  onClose,
  onRetry,
  title,
  message,
  hint,
}: ErrorModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-6 h-6 bg-[#333333] rounded-full flex items-center justify-center hover:bg-[#404040] transition-colors"
      >
        <svg
          className="w-3 h-3 text-white"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Error Icon */}
      <div className="flex justify-center mb-6">
        <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center">
          <svg
            className="w-8 h-8 text-white"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </div>

      {/* Content */}
      <div className="text-center">
        {/* Title */}
        <h2 className="text-xl font-bold text-white mb-3">{title}</h2>

        {/* Message */}
        <p className="text-white text-sm mb-6 leading-relaxed">{message}</p>

        {/* Retry Button */}
        <button
          onClick={onRetry}
          className="w-full bg-[#005CE6] hover:bg-[#0047B3] text-white font-semibold py-3 px-6 rounded-2xl transition-all duration-200 mb-4"
        >
          Try again
        </button>

        {/* Hint */}
        {hint && <p className="text-[#A4A4A4] text-xs">{hint}</p>}
      </div>
    </Modal>
  );
}

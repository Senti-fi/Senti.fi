// src/components/modals/DepositErrorModal.tsx
"use client";
import React from "react";
import ErrorModal from "../ui/ErrorModal";

interface DepositErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRetry: () => void;
  errorType?: "timeout" | "processing" | "rejection" | "network";
}

export default function DepositErrorModal({
  isOpen,
  onClose,
  onRetry,
  errorType = "timeout",
}: DepositErrorModalProps) {
  const getErrorContent = (type: string) => {
    switch (type) {
      case "timeout":
        return {
          title: "We couldn't deposit your money yet.",
          message: "Hang tight or contact support if it takes too long.",
          hint: "Uploading a receipt helps speed things up.",
        };
      case "processing":
        return {
          title: "Receipt processing failed.",
          message:
            "We couldn't read your receipt. Please try uploading a clearer image.",
          hint: "Make sure the receipt is well-lit and all text is visible.",
        };
      case "rejection":
        return {
          title: "Deposit was rejected.",
          message:
            "Your bank rejected this transaction. Please check your account details.",
          hint: "Contact your bank if this continues to happen.",
        };
      case "network":
        return {
          title: "Connection error.",
          message:
            "We're having trouble connecting to your bank. Please try again.",
          hint: "Check your internet connection and try again.",
        };
      default:
        return {
          title: "Something went wrong.",
          message: "We encountered an error processing your deposit.",
          hint: "Please try again or contact support.",
        };
    }
  };

  const content = getErrorContent(errorType);

  return (
    <ErrorModal
      isOpen={isOpen}
      onClose={onClose}
      onRetry={onRetry}
      title={content.title}
      message={content.message}
      hint={content.hint}
    />
  );
}

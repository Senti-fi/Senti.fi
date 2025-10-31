// src/hooks/useModal.ts
import { useState, useCallback } from "react";

export function useModal(initialState = false) {
  const [isOpen, setIsOpen] = useState(initialState);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  return {
    isOpen,
    open,
    close,
    toggle,
  };
}

export function useDepositErrorModal() {
  const modal = useModal();
  const [errorType, setErrorType] = useState<
    "timeout" | "processing" | "rejection" | "network"
  >("timeout");

  const showError = useCallback(
    (type: typeof errorType) => {
      setErrorType(type);
      modal.open();
    },
    [modal]
  );

  const retry = useCallback(() => {
    modal.close();
    // Add retry logic here
    console.log("Retrying deposit...");
  }, [modal]);

  return {
    ...modal,
    errorType,
    showError,
    retry,
  };
}

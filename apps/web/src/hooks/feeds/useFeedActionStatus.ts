"use client";

import { useCallback, useState } from "react";

export function useFeedActionStatus() {
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showAddAnotherAction, setShowAddAnotherAction] = useState(false);

  const clearStatusMessages = useCallback(() => {
    setInfoMessage(null);
    setErrorMessage(null);
    setShowAddAnotherAction(false);
  }, []);

  return {
    infoMessage,
    setInfoMessage,
    errorMessage,
    setErrorMessage,
    showAddAnotherAction,
    setShowAddAnotherAction,
    clearStatusMessages,
  };
}

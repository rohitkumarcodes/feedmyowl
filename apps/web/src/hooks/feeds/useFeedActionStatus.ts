"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const MAX_STATUS_NOTICES = 5;
const DEFAULT_INFO_AUTO_DISMISS_MS = 8000;

export type FeedActionNoticeKind = "info" | "error";

export interface FeedActionNoticeAction {
  label: string;
  onAction: () => void;
}

export interface FeedActionNotice {
  id: string;
  kind: FeedActionNoticeKind;
  text: string;
  dismissible: boolean;
  action?: FeedActionNoticeAction;
  autoDismissMs?: number;
  expiresAt?: number;
}

function createNoticeId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useFeedActionStatus() {
  const [queuedNotices, setQueuedNotices] = useState<FeedActionNotice[]>([]);
  const [progressNotice, setProgressNoticeState] = useState<string | null>(null);
  const [showAddAnotherAction, setShowAddAnotherAction] = useState(false);

  const pushNotice = useCallback(
    (notice: Omit<FeedActionNotice, "id">) => {
      const nextNotice: FeedActionNotice = {
        id: createNoticeId(),
        ...notice,
        expiresAt:
          typeof notice.autoDismissMs === "number"
            ? Date.now() + notice.autoDismissMs
            : undefined,
      };

      setQueuedNotices((previous) => [nextNotice, ...previous].slice(0, MAX_STATUS_NOTICES));
      return nextNotice.id;
    },
    [setQueuedNotices]
  );

  const pushInfo = useCallback(
    (
      text: string,
      options?: {
        action?: FeedActionNoticeAction;
        autoDismissMs?: number;
      }
    ) => {
      return pushNotice({
        kind: "info",
        text,
        dismissible: true,
        action: options?.action,
        autoDismissMs:
          options?.action !== undefined
            ? undefined
            : options?.autoDismissMs ?? DEFAULT_INFO_AUTO_DISMISS_MS,
      });
    },
    [pushNotice]
  );

  const pushError = useCallback(
    (text: string) => {
      return pushNotice({
        kind: "error",
        text,
        dismissible: true,
      });
    },
    [pushNotice]
  );

  const dismissNotice = useCallback((id: string) => {
    setQueuedNotices((previous) => previous.filter((notice) => notice.id !== id));
  }, []);

  useEffect(() => {
    const timeoutIds: number[] = [];
    const now = Date.now();

    for (const notice of queuedNotices) {
      if (notice.expiresAt === undefined) {
        continue;
      }

      const remainingMs = notice.expiresAt - now;
      if (remainingMs <= 0) {
        dismissNotice(notice.id);
        continue;
      }

      const timeoutId = window.setTimeout(() => {
        dismissNotice(notice.id);
      }, remainingMs);
      timeoutIds.push(timeoutId);
    }

    return () => {
      for (const timeoutId of timeoutIds) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [dismissNotice, queuedNotices]);

  const infoMessage = useMemo(() => {
    return queuedNotices.find((notice) => notice.kind === "info")?.text ?? null;
  }, [queuedNotices]);

  const errorMessage = useMemo(() => {
    return queuedNotices.find((notice) => notice.kind === "error")?.text ?? null;
  }, [queuedNotices]);

  const setInfoMessage = useCallback(
    (message: string | null) => {
      if (!message) {
        return;
      }

      pushNotice({
        kind: "info",
        text: message,
        dismissible: true,
        autoDismissMs: showAddAnotherAction ? undefined : DEFAULT_INFO_AUTO_DISMISS_MS,
      });
    },
    [pushNotice, showAddAnotherAction]
  );

  const setErrorMessage = useCallback(
    (message: string | null) => {
      if (!message) {
        return;
      }

      pushError(message);
    },
    [pushError]
  );

  const setProgressNotice = useCallback((message: string) => {
    setProgressNoticeState(message);
  }, []);

  const clearProgressNotice = useCallback(() => {
    setProgressNoticeState(null);
  }, []);

  const clearStatusMessages = useCallback(() => {
    setQueuedNotices([]);
    setProgressNoticeState(null);
    setShowAddAnotherAction(false);
  }, []);

  return {
    queuedNotices,
    progressNotice,
    infoMessage,
    errorMessage,
    showAddAnotherAction,
    setShowAddAnotherAction,
    pushInfo,
    pushError,
    setInfoMessage,
    setErrorMessage,
    dismissNotice,
    setProgressNotice,
    clearProgressNotice,
    clearStatusMessages,
  };
}

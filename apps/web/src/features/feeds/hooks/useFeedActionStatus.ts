"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const MAX_STATUS_NOTICES = 5;
const DEFAULT_SUCCESS_AUTO_DISMISS_MS = 8000;
const NOTICE_DEDUPE_WINDOW_MS = 4000;

export type FeedActionNoticeSeverity = "success" | "info" | "warning" | "error";
export type FeedActionNoticeKind = FeedActionNoticeSeverity;
export type FeedActionNoticeSource =
  | "workspace"
  | "add_feed"
  | "folder"
  | "settings"
  | "network"
  | "unknown";

export interface FeedActionNoticeAction {
  label: string;
  onAction: () => void;
}

export interface FeedActionNotice {
  id: string;
  severity: FeedActionNoticeSeverity;
  kind: FeedActionNoticeKind;
  source?: FeedActionNoticeSource;
  title?: string;
  text: string;
  dismissible: boolean;
  action?: FeedActionNoticeAction;
  retryAction?: FeedActionNoticeAction;
  dedupeKey?: string;
  ariaLiveOverride?: "assertive" | "polite";
  autoDismissMs?: number;
  createdAt: number;
  expiresAt?: number;
}

export interface FeedActionNoticeOptions {
  severity?: FeedActionNoticeSeverity;
  source?: FeedActionNoticeSource;
  title?: string;
  action?: FeedActionNoticeAction;
  retryAction?: FeedActionNoticeAction;
  dedupeKey?: string;
  autoDismissMs?: number;
  ariaLiveOverride?: "assertive" | "polite";
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

  const buildNotice = useCallback(
    (
      notice: Omit<FeedActionNotice, "id" | "createdAt" | "expiresAt"> & {
        autoDismissMs?: number;
      },
    ): FeedActionNotice => {
      const now = Date.now();
      const autoDismissMs =
        typeof notice.autoDismissMs === "number" ? notice.autoDismissMs : undefined;

      return {
        id: createNoticeId(),
        ...notice,
        createdAt: now,
        expiresAt: autoDismissMs ? now + autoDismissMs : undefined,
      };
    },
    [],
  );

  const pushNotice = useCallback(
    (
      notice: Omit<FeedActionNotice, "id" | "createdAt" | "expiresAt"> & {
        autoDismissMs?: number;
      },
    ) => {
      const nextNotice = buildNotice(notice);

      let pushedNoticeId = nextNotice.id;
      setQueuedNotices((previous) => {
        const duplicateByDedupeKey = nextNotice.dedupeKey
          ? previous.find((candidate) => candidate.dedupeKey === nextNotice.dedupeKey)
          : undefined;

        const duplicateByContent = previous.find(
          (candidate) =>
            candidate.severity === nextNotice.severity &&
            candidate.text === nextNotice.text &&
            Date.now() - candidate.createdAt <= NOTICE_DEDUPE_WINDOW_MS,
        );

        const duplicate = duplicateByDedupeKey ?? duplicateByContent;
        if (!duplicate) {
          return [nextNotice, ...previous].slice(0, MAX_STATUS_NOTICES);
        }

        pushedNoticeId = duplicate.id;
        const dedupedNotice: FeedActionNotice = {
          ...duplicate,
          ...nextNotice,
          id: duplicate.id,
        };

        return [dedupedNotice, ...previous.filter((candidate) => candidate.id !== duplicate.id)]
          .slice(0, MAX_STATUS_NOTICES);
      });

      return pushedNoticeId;
    },
    [buildNotice, setQueuedNotices],
  );

  const pushSuccess = useCallback(
    (text: string, options?: FeedActionNoticeOptions) =>
      pushNotice({
        severity: "success",
        kind: "success",
        source: options?.source ?? "workspace",
        title: options?.title,
        text,
        dismissible: true,
        action: options?.action,
        retryAction: options?.retryAction,
        dedupeKey: options?.dedupeKey,
        ariaLiveOverride: options?.ariaLiveOverride,
        autoDismissMs:
          options?.action || options?.retryAction
            ? undefined
            : (options?.autoDismissMs ?? DEFAULT_SUCCESS_AUTO_DISMISS_MS),
      }),
    [pushNotice],
  );

  const pushInfo = useCallback(
    (text: string, options?: FeedActionNoticeOptions) =>
      pushNotice({
        severity: "info",
        kind: "info",
        source: options?.source ?? "workspace",
        title: options?.title,
        text,
        dismissible: true,
        action: options?.action,
        retryAction: options?.retryAction,
        dedupeKey: options?.dedupeKey,
        ariaLiveOverride: options?.ariaLiveOverride,
        autoDismissMs:
          options?.action || options?.retryAction
            ? undefined
            : (options?.autoDismissMs ?? DEFAULT_SUCCESS_AUTO_DISMISS_MS),
      }),
    [pushNotice],
  );

  const pushWarning = useCallback(
    (text: string, options?: FeedActionNoticeOptions) =>
      pushNotice({
        severity: "warning",
        kind: "warning",
        source: options?.source ?? "workspace",
        title: options?.title,
        text,
        dismissible: true,
        action: options?.action,
        retryAction: options?.retryAction,
        dedupeKey: options?.dedupeKey,
        ariaLiveOverride: options?.ariaLiveOverride,
        autoDismissMs: options?.autoDismissMs,
      }),
    [pushNotice],
  );

  const pushError = useCallback(
    (text: string, options?: FeedActionNoticeOptions) =>
      pushNotice({
        severity: "error",
        kind: "error",
        source: options?.source ?? "workspace",
        title: options?.title,
        text,
        dismissible: true,
        action: options?.action,
        retryAction: options?.retryAction,
        dedupeKey: options?.dedupeKey,
        ariaLiveOverride: options?.ariaLiveOverride,
      }),
    [pushNotice],
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
    return (
      queuedNotices.find(
        (notice) => notice.severity === "success" || notice.severity === "info",
      )?.text ?? null
    );
  }, [queuedNotices]);

  const errorMessage = useMemo(() => {
    return (
      queuedNotices.find(
        (notice) => notice.severity === "error" || notice.severity === "warning",
      )?.text ?? null
    );
  }, [queuedNotices]);

  const setInfoMessage = useCallback(
    (message: string | null, options?: FeedActionNoticeOptions) => {
      if (!message) {
        return;
      }

      pushSuccess(message, {
        ...options,
        autoDismissMs: showAddAnotherAction
          ? undefined
          : (options?.autoDismissMs ?? DEFAULT_SUCCESS_AUTO_DISMISS_MS),
      });
    },
    [pushSuccess, showAddAnotherAction],
  );

  const setErrorMessage = useCallback(
    (message: string | null, options?: FeedActionNoticeOptions) => {
      if (!message) {
        return;
      }

      if (options?.severity === "warning") {
        pushWarning(message, options);
        return;
      }

      pushError(message, options);
    },
    [pushError, pushWarning],
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
    pushSuccess,
    pushInfo,
    pushWarning,
    pushError,
    setInfoMessage,
    setErrorMessage,
    dismissNotice,
    setProgressNotice,
    clearProgressNotice,
    clearStatusMessages,
  };
}

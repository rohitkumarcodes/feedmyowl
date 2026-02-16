/**
 * Shared sidebar notice model and mapper for semantic message rendering.
 */

export type SidebarNoticeKind =
  | "error"
  | "warning"
  | "success"
  | "progress"
  | "offline"
  | "info";

export interface SidebarNoticeAction {
  label: string;
  onAction: () => void;
}

export interface SidebarNotice {
  id: string;
  kind: SidebarNoticeKind;
  title?: string;
  text: string;
  role: "alert" | "status";
  ariaLive: "assertive" | "polite";
  dismissible: boolean;
  action?: SidebarNoticeAction;
}

interface BuildSidebarNoticesOptions {
  progressMessage: string | null;
  networkMessage: string | null;
  queuedNotices: Array<{
    id: string;
    kind: "success" | "info" | "warning" | "error";
    title?: string;
    text: string;
    dismissible: boolean;
    retryAction?: SidebarNoticeAction;
    action?: SidebarNoticeAction;
    ariaLiveOverride?: "assertive" | "polite";
  }>;
  showAddAnotherAction: boolean;
  onAddAnother: () => void;
}

function resolveNoticeRole(
  kind: SidebarNoticeKind,
  override?: "assertive" | "polite",
): SidebarNotice["role"] {
  if (kind === "error" || override === "assertive") {
    return "alert";
  }

  return "status";
}

function resolveNoticeAriaLive(
  kind: SidebarNoticeKind,
  override?: "assertive" | "polite",
): SidebarNotice["ariaLive"] {
  if (override) {
    return override;
  }

  if (kind === "error") {
    return "assertive";
  }

  return "polite";
}

/**
 * Convert legacy message fields into a typed notice list for the sidebar UI.
 */
export function buildSidebarNotices({
  progressMessage,
  networkMessage,
  queuedNotices,
  showAddAnotherAction,
  onAddAnother,
}: BuildSidebarNoticesOptions): SidebarNotice[] {
  const notices: SidebarNotice[] = [];

  if (progressMessage) {
    notices.push({
      id: "progress",
      kind: "progress",
      text: progressMessage,
      role: resolveNoticeRole("progress"),
      ariaLive: resolveNoticeAriaLive("progress"),
      dismissible: false,
    });
  }

  if (networkMessage) {
    notices.push({
      id: "offline",
      kind: "offline",
      text: networkMessage,
      role: resolveNoticeRole("offline"),
      ariaLive: resolveNoticeAriaLive("offline"),
      dismissible: false,
    });
  }

  let addAnotherActionAttached = false;

  for (const queuedNotice of queuedNotices) {
    const shouldAttachAddAnother =
      !addAnotherActionAttached &&
      showAddAnotherAction &&
      (queuedNotice.kind === "success" || queuedNotice.kind === "info") &&
      queuedNotice.action === undefined &&
      queuedNotice.retryAction === undefined;

    if (shouldAttachAddAnother) {
      addAnotherActionAttached = true;
    }

    notices.push({
      id: queuedNotice.id,
      kind: queuedNotice.kind,
      title: queuedNotice.title,
      text: queuedNotice.text,
      role: resolveNoticeRole(queuedNotice.kind, queuedNotice.ariaLiveOverride),
      ariaLive: resolveNoticeAriaLive(queuedNotice.kind, queuedNotice.ariaLiveOverride),
      dismissible: queuedNotice.dismissible,
      action:
        queuedNotice.action ??
        queuedNotice.retryAction ??
        (shouldAttachAddAnother
          ? {
              label: "Add another",
              onAction: onAddAnother,
            }
          : undefined),
    });
  }

  return notices;
}

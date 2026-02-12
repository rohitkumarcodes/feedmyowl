/**
 * Shared sidebar notice model and mapper for semantic message rendering.
 */

export type SidebarNoticeKind = "error" | "progress" | "offline" | "info";

export interface SidebarNoticeAction {
  label: string;
  onAction: () => void;
}

export interface SidebarNotice {
  id: string;
  kind: SidebarNoticeKind;
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
    kind: "info" | "error";
    text: string;
    dismissible: boolean;
    action?: SidebarNoticeAction;
  }>;
  showAddAnotherAction: boolean;
  onAddAnother: () => void;
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
      role: "status",
      ariaLive: "polite",
      dismissible: false,
    });
  }

  if (networkMessage) {
    notices.push({
      id: "offline",
      kind: "offline",
      text: networkMessage,
      role: "status",
      ariaLive: "polite",
      dismissible: false,
    });
  }

  let addAnotherActionAttached = false;

  for (const queuedNotice of queuedNotices) {
    const shouldAttachAddAnother =
      !addAnotherActionAttached &&
      showAddAnotherAction &&
      queuedNotice.kind === "info" &&
      queuedNotice.action === undefined;

    if (shouldAttachAddAnother) {
      addAnotherActionAttached = true;
    }

    notices.push({
      id: queuedNotice.id,
      kind: queuedNotice.kind,
      text: queuedNotice.text,
      role: queuedNotice.kind === "error" ? "alert" : "status",
      ariaLive: queuedNotice.kind === "error" ? "assertive" : "polite",
      dismissible: queuedNotice.dismissible,
      action:
        queuedNotice.action ??
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

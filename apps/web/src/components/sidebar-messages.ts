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
  addFeedProgressMessage: string | null;
  networkMessage: string | null;
  infoMessage: string | null;
  errorMessage: string | null;
  showAddAnotherAction: boolean;
  onAddAnother: () => void;
}

/**
 * Convert legacy message fields into a typed notice list for the sidebar UI.
 */
export function buildSidebarNotices({
  addFeedProgressMessage,
  networkMessage,
  infoMessage,
  errorMessage,
  showAddAnotherAction,
  onAddAnother,
}: BuildSidebarNoticesOptions): SidebarNotice[] {
  const notices: SidebarNotice[] = [];

  if (addFeedProgressMessage) {
    notices.push({
      id: "add-feed-progress",
      kind: "progress",
      text: addFeedProgressMessage,
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

  if (infoMessage) {
    notices.push({
      id: "info",
      kind: "info",
      text: infoMessage,
      role: "status",
      ariaLive: "polite",
      dismissible: true,
      action: showAddAnotherAction
        ? {
            label: "Add another",
            onAction: onAddAnother,
          }
        : undefined,
    });
  }

  if (errorMessage) {
    notices.push({
      id: "error",
      kind: "error",
      text: errorMessage,
      role: "alert",
      ariaLive: "assertive",
      dismissible: true,
    });
  }

  return notices;
}

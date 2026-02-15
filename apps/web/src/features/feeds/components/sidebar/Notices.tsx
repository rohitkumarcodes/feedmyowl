import type { SidebarNotice } from "./sidebar-messages";
import styles from "./Sidebar.module.css";

interface NoticesProps {
  notices: SidebarNotice[];
  onDismissMessage: (id: string) => void;
}

export function Notices({ notices, onDismissMessage }: NoticesProps) {
  const noticeKindClassNames: Record<SidebarNotice["kind"], string> = {
    error: styles.sidebarMessageError,
    progress: styles.sidebarMessageProgress,
    offline: styles.sidebarMessageOffline,
    info: styles.sidebarMessageInfo,
  };

  const noticeKindIcons: Record<SidebarNotice["kind"], string> = {
    error: "!",
    progress: "~",
    offline: "o",
    info: "i",
  };

  return notices.map((notice) => (
    <div
      key={notice.id}
      className={`${styles.sidebarMessage} ${noticeKindClassNames[notice.kind]}`}
      role={notice.role}
      aria-live={notice.ariaLive}
    >
      <span className={styles.sidebarMessageIcon} aria-hidden="true">
        {noticeKindIcons[notice.kind]}
      </span>
      <span className={styles.sidebarMessageText}>{notice.text}</span>
      {notice.action ? (
        <button
          type="button"
          className={styles.sidebarMessageAction}
          onClick={notice.action.onAction}
        >
          {notice.action.label}
        </button>
      ) : null}
      {notice.dismissible ? (
        <button
          type="button"
          className={styles.sidebarMessageDismiss}
          onClick={() => onDismissMessage(notice.id)}
          aria-label={`Dismiss ${notice.kind} message`}
        >
          x
        </button>
      ) : null}
    </div>
  ));
}

import type { SidebarNotice } from "./sidebar-messages";
import styles from "./Sidebar.module.css";

interface NoticesProps {
  notices: SidebarNotice[];
  onDismissMessage: (id: string) => void;
}

export function Notices({ notices, onDismissMessage }: NoticesProps) {
  const noticeKindClassNames: Record<SidebarNotice["kind"], string> = {
    error: styles.sidebarMessageError,
    warning: styles.sidebarMessageWarning,
    success: styles.sidebarMessageSuccess,
    progress: styles.sidebarMessageProgress,
    offline: styles.sidebarMessageOffline,
    info: styles.sidebarMessageInfo,
  };

  const noticeKindIcons: Record<SidebarNotice["kind"], string> = {
    error: "x",
    warning: "!",
    success: "v",
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
      <span className={styles.sidebarMessageText}>
        {notice.title ? (
          <span className={styles.sidebarMessageTitle}>{notice.title}</span>
        ) : null}
        <span>{notice.text}</span>
      </span>
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
          aria-label={
            notice.title
              ? `Dismiss ${notice.title} notification`
              : `Dismiss ${notice.kind} notification`
          }
        >
          x
        </button>
      ) : null}
    </div>
  ));
}

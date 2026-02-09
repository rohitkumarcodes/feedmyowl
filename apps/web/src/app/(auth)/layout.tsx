/**
 * Authenticated route-group layout with quiet account controls.
 */

import Link from "next/link";
import { UserMenu } from "@/lib/auth";
import styles from "./layout.module.css";

/**
 * Wraps authenticated pages and keeps account actions minimally visible.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={styles.shell}>
      <div className={styles.brandSlot}>
        <Link href="/feeds" className={styles.brand}>
          Feed my owl 🦉
        </Link>
      </div>

      <div className={styles.accountControls}>
        <UserMenu afterSignOutUrl="/sign-in" />
        <Link
          href="/settings"
          className={styles.settingsLink}
          aria-label="Settings"
          title="Settings"
        >
          <svg
            className={styles.settingsIcon}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M9 2H15V4H18V7H20V13H18V16H15V18H9V16H6V13H4V7H6V4H9V2Z"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="square"
              strokeLinejoin="miter"
            />
            <rect
              x="10"
              y="9.8"
              width="4"
              height="4"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinejoin="miter"
            />
          </svg>
        </Link>
      </div>

      {children}
    </div>
  );
}

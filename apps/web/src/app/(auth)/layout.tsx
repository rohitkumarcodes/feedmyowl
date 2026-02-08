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
        <Link href="/settings" className={styles.settingsLink}>
          <svg
            className={styles.settingsIcon}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M9.75 3.5H14.25L14.9 5.9C15.25 6.05 15.58 6.24 15.88 6.47L18.2 5.85L20.45 9.75L18.72 11.45C18.75 11.63 18.75 11.82 18.75 12C18.75 12.18 18.75 12.37 18.72 12.55L20.45 14.25L18.2 18.15L15.88 17.53C15.58 17.76 15.25 17.95 14.9 18.1L14.25 20.5H9.75L9.1 18.1C8.75 17.95 8.42 17.76 8.12 17.53L5.8 18.15L3.55 14.25L5.28 12.55C5.25 12.37 5.25 12.18 5.25 12C5.25 11.82 5.25 11.63 5.28 11.45L3.55 9.75L5.8 5.85L8.12 6.47C8.42 6.24 8.75 6.05 9.1 5.9L9.75 3.5Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          <span>Settings</span>
        </Link>
        <UserMenu afterSignOutUrl="/sign-in" />
      </div>

      {children}
    </div>
  );
}

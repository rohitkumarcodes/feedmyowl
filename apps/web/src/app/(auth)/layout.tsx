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
      <Link href="/feeds" className={styles.brand}>
        Feed my owl 🦉
      </Link>

      <div className={styles.accountControls}>
        <Link href="/settings" className={styles.settingsLink}>
          Settings
        </Link>
        <UserMenu afterSignOutUrl="/sign-in" />
      </div>

      {children}
    </div>
  );
}

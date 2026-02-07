/**
 * Authenticated route-group layout.
 *
 * This layout intentionally stays minimal so each page can control its own
 * structure without inheriting a decorative shell.
 */
import Link from "next/link";
import { UserMenu } from "@/lib/auth";
import styles from "./layout.module.css";

/**
 * Returns route-group children without extra wrapper UI.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={styles.shell}>
      <div className={styles.accountControls}>
        <Link href="/settings" className={styles.settingsLink}>
          Account settings
        </Link>
        <UserMenu afterSignOutUrl="/sign-in" />
      </div>
      {children}
    </div>
  );
}

/**
 * Authenticated route-group layout with quiet account controls.
 */

import { AccountControls } from "./account-controls";
import styles from "./layout.module.css";

/**
 * Wraps authenticated pages and keeps account actions minimally visible.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <AccountControls />
      {children}
    </div>
  );
}

/**
 * Authenticated route-group layout with quiet account controls.
 */

import Link from "next/link";
import type { Metadata } from "next";
import { cache } from "react";
import { AccountControls } from "./account-controls";
import { getAuthenticatedAppUser } from "@/lib/server/app-user";
import { db, eq, users } from "@/lib/server/database";
import {
  buildOwlFaviconDataUri,
  coerceOwlAscii,
  DEFAULT_OWL_ASCII,
} from "@/lib/shared/owl-brand";
import styles from "./layout.module.css";

const getCurrentAuthChromeData = cache(async () => {
  const { appUser } = await getAuthenticatedAppUser();

  if (!appUser) {
    return {
      owlAscii: DEFAULT_OWL_ASCII,
    };
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, appUser.id),
    columns: {
      owlAscii: true,
    },
  });

  return {
    owlAscii: coerceOwlAscii(user?.owlAscii),
  };
});

export async function generateMetadata(): Promise<Metadata> {
  const { owlAscii } = await getCurrentAuthChromeData();

  return {
    icons: {
      icon: buildOwlFaviconDataUri(owlAscii),
    },
  };
}

/**
 * Wraps authenticated pages and keeps account actions minimally visible.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const { owlAscii } = await getCurrentAuthChromeData();

  return (
    <div className={styles.shell}>
      <div className={styles.brandSlot}>
        <Link href="/feeds" className={styles.brand}>
          <span className={styles.brandText}>feed my owl</span>
          <span className={styles.brandOwl}>{owlAscii}</span>
        </Link>
      </div>

      <AccountControls />

      {children}
    </div>
  );
}

/**
 * Authenticated route-group layout with quiet account controls.
 */

import Link from "next/link";
import type { Metadata } from "next";
import { cache } from "react";
import { AccountControls } from "./account-controls";
import { getAuthenticatedAppUser } from "@/lib/app-user";
import { db, eq, users } from "@/lib/database";
import { AuthThemeBootstrap } from "@/components/auth-theme-bootstrap";
import {
  buildOwlFaviconDataUri,
  coerceOwlAscii,
  DEFAULT_OWL_ASCII,
} from "@/lib/owl-brand";
import { coerceThemeMode, DEFAULT_THEME_MODE } from "@/lib/theme-mode";
import styles from "./layout.module.css";

const getCurrentAuthChromeData = cache(async () => {
  const { appUser } = await getAuthenticatedAppUser();

  if (!appUser) {
    return {
      owlAscii: DEFAULT_OWL_ASCII,
      themeMode: DEFAULT_THEME_MODE,
    };
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, appUser.id),
    columns: {
      owlAscii: true,
      themeMode: true,
    },
  });

  return {
    owlAscii: coerceOwlAscii(user?.owlAscii),
    themeMode: coerceThemeMode(user?.themeMode),
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
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { owlAscii, themeMode } = await getCurrentAuthChromeData();

  return (
    <div className={styles.shell} data-theme-mode={themeMode}>
      <AuthThemeBootstrap initialThemeMode={themeMode} />
      <div className={styles.brandSlot}>
        <Link href="/feeds" className={styles.brand}>
          <span className={styles.brandText}>Feed my owl</span>
          <span className={styles.brandOwl}>{owlAscii}</span>
        </Link>
      </div>

      <AccountControls />

      {children}
    </div>
  );
}

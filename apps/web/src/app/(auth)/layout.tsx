/**
 * Authenticated route-group layout with quiet account controls.
 */

import Link from "next/link";
import type { Metadata } from "next";
import { AccountControls } from "./account-controls";
import { requireAuth } from "@/lib/auth";
import { ensureUserRecord } from "@/lib/app-user";
import { db, eq, users } from "@/lib/database";
import { AuthThemeBootstrap } from "@/components/auth-theme-bootstrap";
import {
  buildOwlFaviconDataUri,
  coerceOwlAscii,
  DEFAULT_OWL_ASCII,
} from "@/lib/owl-brand";
import { coerceThemeMode, DEFAULT_THEME_MODE } from "@/lib/theme-mode";
import styles from "./layout.module.css";

async function getCurrentUserOwlAscii() {
  const { clerkId } = await requireAuth();
  const ensuredUser = await ensureUserRecord(clerkId);

  if (!ensuredUser) {
    return DEFAULT_OWL_ASCII;
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, ensuredUser.id),
    columns: {
      owlAscii: true,
    },
  });

  return coerceOwlAscii(user?.owlAscii);
}

async function getCurrentUserThemeMode() {
  const { clerkId } = await requireAuth();
  const ensuredUser = await ensureUserRecord(clerkId);

  if (!ensuredUser) {
    return DEFAULT_THEME_MODE;
  }

  const user = await db.query.users
    .findFirst({
      where: eq(users.id, ensuredUser.id),
      columns: {
        themeMode: true,
      },
    });

  return coerceThemeMode(user?.themeMode);
}

export async function generateMetadata(): Promise<Metadata> {
  const owlAscii = await getCurrentUserOwlAscii();

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
  const owlAscii = await getCurrentUserOwlAscii();
  const initialThemeMode = await getCurrentUserThemeMode();

  return (
    <div className={styles.shell} data-theme-mode={initialThemeMode}>
      <AuthThemeBootstrap initialThemeMode={initialThemeMode} />
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

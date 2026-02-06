"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./auth-navigation.module.css";

const navItems = [
  { href: "/feeds", label: "Feeds" },
  { href: "/settings", label: "Settings" },
];

export function AuthNavigation() {
  const pathname = usePathname();

  return (
    <nav className={styles.nav} aria-label="Primary">
      <Link href="/feeds" className={styles.brand}>
        FeedMyOwl
      </Link>
      <div className={styles.links}>
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.link} ${isActive ? styles.linkActive : ""}`}
              aria-current={isActive ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

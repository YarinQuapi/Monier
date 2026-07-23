"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import styles from "./layout.module.css";

function GridIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function TrendingUpIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 17 9 11 13 15 21 6" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="15 6 21 6 21 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ReceiptIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="9" y1="8" x2="15" y2="8" strokeLinecap="round" />
      <line x1="9" y1="12" x2="15" y2="12" strokeLinecap="round" />
    </svg>
  );
}

function CardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="5" width="20" height="14" rx="2.5" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path
        d="M21 12a9 9 0 1 1-2.6-6.36M21 4v5h-5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path
        d="M20.5 12.5 12 21l-9-9L12.5 3H21v8.5z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="15.5" cy="7.5" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

const NAV_LINKS: { href: string; label: string; icon: ReactNode }[] = [
  { href: "/dashboard", label: "Dashboard", icon: <GridIcon /> },
  { href: "/income", label: "Income", icon: <TrendingUpIcon /> },
  { href: "/purchases", label: "Purchases", icon: <ReceiptIcon /> },
  { href: "/payment-methods", label: "Payment Methods", icon: <CardIcon /> },
  { href: "/subscriptions", label: "Subscriptions", icon: <RefreshIcon /> },
];

export function Nav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();

  const links = isAdmin
    ? [...NAV_LINKS, { href: "/admin/categories", label: "Categories", icon: <TagIcon /> }]
    : NAV_LINKS;

  return (
    <nav className={styles.nav}>
      {links.map((link) => {
        const isActive =
          pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`${styles.navLink} ${isActive ? styles.navLinkActive : ""}`}
          >
            <span className={styles.navIcon}>{link.icon}</span>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

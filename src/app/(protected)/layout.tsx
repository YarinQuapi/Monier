import Link from "next/link";
import { verifySession } from "@/lib/authorization";
import { logout } from "./actions";
import styles from "./layout.module.css";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/income", label: "Income" },
  { href: "/purchases", label: "Purchases" },
  { href: "/payment-methods", label: "Payment Methods" },
  { href: "/subscriptions", label: "Subscriptions" },
];

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await verifySession();
  const isAdmin = session.user.role === "ADMIN";

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>Money Management</div>

        <nav className={styles.nav}>
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
          {isAdmin && <Link href="/admin/categories">Admin: Categories</Link>}
        </nav>

        <div className={styles.footer}>
          <span>{session.user.email}</span>
          <form action={logout}>
            <button type="submit">Sign out</button>
          </form>
        </div>
      </aside>

      <main className={styles.main}>{children}</main>
    </div>
  );
}

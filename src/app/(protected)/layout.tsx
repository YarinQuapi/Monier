import { verifySession } from "@/lib/authorization";
import { logout } from "./actions";
import { Nav } from "./Nav";
import styles from "./layout.module.css";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await verifySession();
  const isAdmin = session.user.role === "ADMIN";
  const initial = (session.user.name ?? session.user.email ?? "?")
    .charAt(0)
    .toUpperCase();

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>$</span>
          Money Management
        </div>

        <Nav isAdmin={isAdmin} />

        <div className={styles.footer}>
          <div className={styles.user}>
            <span className={styles.avatar}>{initial}</span>
            <div className={styles.userInfo}>
              <span className={styles.userEmail}>{session.user.email}</span>
              <span className={styles.userRole}>
                {session.user.role === "ADMIN" ? "Administrator" : "Member"}
              </span>
            </div>
          </div>
          <form action={logout}>
            <button className={styles.signOut} type="submit">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <main className={styles.main}>
        <div className={styles.mainInner}>{children}</div>
      </main>
    </div>
  );
}
